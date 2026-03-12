/**
 * @module DCCHost/systemPrompt
 * @description Generates a system prompt section describing connected DCC applications
 * and their available tools, for injection into workspace and agent chat prompts.
 */

/**
 * Generates a system prompt injection describing all connected DCC applications
 * and the tools they expose. Returns an empty string if no DCCs are connected
 * or if DCCMCPHost is not available (Phase 2 not merged).
 *
 * @returns {string} A markdown-formatted system prompt section, or empty string
 */
function getDCCSystemPromptInjection() {
  let DCCMCPHost;
  try {
    DCCMCPHost = require("./index");
  } catch (e) {
    return "";
  }

  let host;
  try {
    host = new DCCMCPHost();
  } catch (e) {
    return "";
  }

  // getAllTools() is synchronous - returns cached tools from active connections
  const allTools = host.getAllTools();
  if (!allTools || allTools.length === 0) return "";

  // Group tools by connection
  const toolsByConnection = new Map();
  for (const tool of allTools) {
    const key = `${tool.connectionName}|${tool.appType}|${tool.connectionId}`;
    if (!toolsByConnection.has(key)) {
      toolsByConnection.set(key, {
        name: tool.connectionName,
        appType: tool.appType,
        connectionId: tool.connectionId,
        tools: [],
      });
    }
    toolsByConnection.get(key).tools.push(tool);
  }

  const connectionDescriptions = [];
  for (const [, conn] of toolsByConnection) {
    const toolList = conn.tools
      .map((t) => `\`${t.namespacedName}\``)
      .join(", ");
    connectionDescriptions.push(
      `- **${conn.name}** (${conn.appType}): ${conn.tools.length} tool(s) available: ${toolList}`
    );
  }

  return `
## Connected DCC Applications

You have access to the following creative applications via MCP protocol:

${connectionDescriptions.join("\n")}

When the user asks you to perform actions in these applications, use the appropriate namespaced tool (e.g., blender.create_mesh, unreal.spawn_actor).

If a request could apply to multiple connected apps, ask the user to clarify which one they mean.`.trim();
}

module.exports = { getDCCSystemPromptInjection };
