const prisma = require("../utils/prisma");

const DCCConnection = {
  supportedAppTypes: ["unreal", "blender", "maya", "houdini", "unity", "godot"],
  supportedTransports: ["stdio", "sse", "http"],

  writable: [
    "name",
    "appType",
    "host",
    "port",
    "transport",
    "autoConnect",
  ],

  validations: {
    name: (value) => {
      if (!value || typeof value !== "string") return null;
      return String(value).slice(0, 255);
    },
    appType: (value) => {
      if (
        !value ||
        typeof value !== "string" ||
        !DCCConnection.supportedAppTypes.includes(value)
      )
        return null;
      return value;
    },
    host: (value) => {
      if (!value || typeof value !== "string") return "localhost";
      return String(value).slice(0, 255);
    },
    port: (value) => {
      const p = parseInt(value);
      if (isNaN(p) || p < 1 || p > 65535) return null;
      return p;
    },
    transport: (value) => {
      if (
        !value ||
        typeof value !== "string" ||
        !DCCConnection.supportedTransports.includes(value)
      )
        return "sse";
      return value;
    },
    autoConnect: (value) => {
      return Boolean(value);
    },
  },

  validateFields: function (updates = {}) {
    const validatedFields = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!this.writable.includes(key)) continue;
      if (this.validations[key]) {
        validatedFields[key] = this.validations[key](value);
      } else {
        validatedFields[key] = value;
      }
    }
    return validatedFields;
  },

  new: async function (data = {}, creatorId = null) {
    try {
      const validated = this.validateFields(data);
      if (!validated.name)
        return { connection: null, message: "name is required" };
      if (!validated.appType)
        return {
          connection: null,
          message: `appType must be one of: ${this.supportedAppTypes.join(", ")}`,
        };
      if (!validated.port)
        return { connection: null, message: "A valid port (1-65535) is required" };

      const connection = await prisma.dcc_connections.create({
        data: {
          ...validated,
          createdBy: creatorId,
        },
      });
      return { connection, message: null };
    } catch (error) {
      console.error(error.message);
      return { connection: null, message: error.message };
    }
  },

  update: async function (id = null, updates = {}) {
    if (!id) throw new Error("No connection id provided for update");

    const validatedUpdates = this.validateFields(updates);
    if (Object.keys(validatedUpdates).length === 0)
      return { connection: { id }, message: "No valid fields to update!" };

    try {
      const connection = await prisma.dcc_connections.update({
        where: { id },
        data: {
          ...validatedUpdates,
          lastUpdatedAt: new Date(),
        },
      });
      return { connection, message: null };
    } catch (error) {
      console.error(error.message);
      return { connection: null, message: error.message };
    }
  },

  get: async function (clause = {}) {
    try {
      const connection = await prisma.dcc_connections.findFirst({
        where: clause,
      });
      return connection;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  where: async function (clause = {}, limit = null, orderBy = null) {
    try {
      const results = await prisma.dcc_connections.findMany({
        where: clause,
        ...(limit !== null ? { take: limit } : {}),
        ...(orderBy !== null ? { orderBy } : {}),
      });
      return results;
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },

  getAll: async function () {
    try {
      return await prisma.dcc_connections.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },

  delete: async function (clause = {}) {
    try {
      await prisma.dcc_connections.delete({
        where: clause,
      });
      return true;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  },

  count: async function (clause = {}) {
    try {
      return await prisma.dcc_connections.count({
        where: clause,
      });
    } catch (error) {
      console.error(error.message);
      return 0;
    }
  },
};

module.exports = { DCCConnection };
