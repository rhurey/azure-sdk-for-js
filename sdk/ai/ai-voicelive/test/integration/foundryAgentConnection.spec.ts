// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Foundry Agent Connection Integration Tests
 *
 * These tests verify that the SDK can correctly configure Foundry agents
 * and establish connections with the VoiceLive service.
 *
 * Foundry agents are AI agents deployed in Azure AI Foundry that can be
 * integrated into VoiceLive conversations to provide specialized capabilities.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import type { KeyCredential } from "@azure/core-auth";
import { VoiceLiveClient, type VoiceLiveSession, KnownServerEventType } from "../../src/index.js";
import { isLiveMode } from "@azure-tools/test-recorder";
import { createTestCredential } from "@azure-tools/test-credential";
import { SessionEventRecorder } from "../infrastructure/sessionEventRecorder.js";
import {
  TestConstants,
  TEST_AGENT_NAME,
  createFoundryAgentTool,
  getOrCreateTestAgent,
} from "../infrastructure/index.js";

// Only configure dotenv in Node.js environments
if (typeof self === "undefined") {
  try {
    console.log("Configuring dotenv for Foundry Agent Connection tests");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config();
  } catch {
    // dotenv not available or we're in a browser, ignore
  }
} else {
  console.log("Skipping dotenv configuration in browser environment");
}

describe.runIf(isLiveMode())("Foundry Agent Connection - Live", () => {
  let client: VoiceLiveClient;
  let sessions: VoiceLiveSession[] = [];
  let testAgentName: string = "";
  const endpoint = process.env.VOICELIVE_ENDPOINT || process.env.AI_SERVICES_ENDPOINT;
  const apiKey = process.env.VOICELIVE_API_KEY || process.env.AI_SERVICES_KEY;
  const model = "gpt-4o";
  const timeoutMs = TestConstants.AGENT_TIMEOUT_MS;

  beforeAll(async () => {
    if (!endpoint) {
      throw new Error("Missing VOICELIVE_ENDPOINT or AI_SERVICES_ENDPOINT environment variable");
    }

    // Get or create the shared test agent
    try {
      testAgentName = await getOrCreateTestAgent();
      console.log(`Using test agent: ${testAgentName}`);
    } catch (error) {
      console.warn(`Could not setup test agent: ${error}`);
      // Tests will use the constant name if agent creation fails
      testAgentName = TEST_AGENT_NAME;
    }
  });

  beforeEach(function () {
    if (!endpoint) {
      throw new Error("Missing VOICELIVE_ENDPOINT or AI_SERVICES_ENDPOINT environment variable");
    }

    console.info(`Creating VoiceLiveClient for endpoint: ${endpoint}`);
    // Create client - prefer API key, fall back to token credential
    if (!apiKey) {
      const credential = createTestCredential();
      client = new VoiceLiveClient(endpoint, credential);
    } else {
      client = new VoiceLiveClient(endpoint, { key: apiKey } as KeyCredential);
    }
  });

  afterEach(async () => {
    // Clean up all sessions
    for (const session of sessions) {
      try {
        if (session.isConnected) {
          await session.disconnect();
        }
      } catch (error) {
        console.warn("Error disconnecting session:", error);
      }
    }
    sessions = [];
  });

  describe("Basic Connection", () => {
    it(
      "should connect with Foundry agent configured",
      async () => {
        // This test verifies that a session can be established with a Foundry agent configured
        const foundryAgent = createFoundryAgentTool(testAgentName);

        const sessionConfig = {
          model,
          tools: [foundryAgent],
        };

        const session = await client.createSession(sessionConfig);
        sessions.push(session);

        const recorder = new SessionEventRecorder(session);

        await session.connect();

        await session.updateSession(sessionConfig);

        // Wait for session created
        await recorder.waitForEvent(KnownServerEventType.SessionCreated);
        await recorder.waitForEvent(KnownServerEventType.SessionUpdated);

        // Verify session is connected
        expect(session.isConnected).toBe(true);
        expect(session.sessionId).toBeTruthy();
        console.log("Session connected successfully with Foundry agent configured");
      },
      timeoutMs,
    );
  });
});
