// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Test Agent Infrastructure
 *
 * Provides utilities for creating and discovering Foundry agents
 * for integration testing with VoiceLive.
 */

import { AIProjectClient } from "@azure/ai-projects";
import type { PromptAgentDefinition } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import { TestConstants } from "./testConstants.js";
import type { FoundryAgentTool } from "../../src/models/index.js";

/**
 * Fixed name for the VoiceLive integration test agent.
 * This agent is created once and reused across all test runs.
 */
export const TEST_AGENT_NAME = "VoiceLiveIntegrationTestAgentV2";

/**
 * Gets the project endpoint from environment variables.
 */
function getProjectEndpoint(): string {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  if (!endpoint) {
    throw new Error("Missing FOUNDRY_PROJECT_ENDPOINT environment variable");
  }
  return endpoint;
}

/**
 * Gets the project name from environment variables or falls back to test constants.
 */
function getProjectName(): string {
  return process.env.FOUNDRY_PROJECT_NAME || TestConstants.FOUNDRY_PROJECT_NAME;
}

/**
 * Creates the VoiceLive integration test agent.
 * This agent helps with simple math questions - useful for testing agent invocation.
 *
 * @returns Promise resolving to the created agent name
 */
export async function createTestAgent(): Promise<string> {
  const endpoint = getProjectEndpoint();
  const modelName = process.env.MODEL_DEPLOYMENT_NAME || "gpt-4o";

  console.info(`Creating test agent with model: ${modelName} at endpoint: ${endpoint}`);
  const client = new AIProjectClient(endpoint, new DefaultAzureCredential());

  const definition: PromptAgentDefinition = {
    kind: "prompt",
    model: modelName,
    instructions:
      "You are a helpful math assistant. When asked a math question, solve it step by step and provide the answer.",
  };

  const agentVersion = await client.agents.createVersion(TEST_AGENT_NAME, definition);
  console.info(
    `Agent created (id: ${agentVersion.id}, name: ${agentVersion.name}, version: ${agentVersion.version})`,
  );

  return agentVersion.name;
}

/**
 * Finds the VoiceLive integration test agent if it exists.
 *
 * @returns Promise resolving to the agent name if found, or empty string if not found
 */
export async function findTestAgent(): Promise<string> {
  const endpoint = getProjectEndpoint();
  const client = new AIProjectClient(endpoint, new DefaultAzureCredential());
  console.info("Searching for existing test agent at endpoint:", endpoint);

  for await (const agent of client.agents.list()) {
    console.info(`Found agent: ${agent.name}`);
    if (agent.name === TEST_AGENT_NAME) {
      return agent.name;
    }
  }

  console.info("Test agent not found.");
  return "";
}

/**
 * Gets or creates the VoiceLive integration test agent.
 * First attempts to find an existing agent, creates one if not found.
 *
 * @returns Promise resolving to the agent name
 */
export async function getOrCreateTestAgent(): Promise<string> {
  const existingAgent = await findTestAgent();
  if (existingAgent) {
    return existingAgent;
  }

  return createTestAgent();
}

/**
 * Creates a FoundryAgentTool configuration for use in VoiceLive sessions.
 *
 * @param agentName - The name of the Foundry agent (defaults to TEST_AGENT_NAME)
 * @param options - Additional configuration options
 * @returns FoundryAgentTool configuration object
 */
export function createFoundryAgentTool(
  agentName: string = TEST_AGENT_NAME,
  options?: {
    projectName?: string;
    agentVersion?: string;
    clientId?: string;
    description?: string;
    agentContextType?: "no_context" | "agent_context";
    returnAgentResponseDirectly?: boolean;
  },
): FoundryAgentTool {
  return {
    type: "foundry_agent",
    agentName,
    projectName: options?.projectName ?? getProjectName(),
    agentVersion: options?.agentVersion,
    clientId: options?.clientId,
    description: options?.description ?? "A math assistant that solves math problems step by step",
    agentContextType: options?.agentContextType ?? "agent_context",
    returnAgentResponseDirectly: options?.returnAgentResponseDirectly ?? false,
  };
}
