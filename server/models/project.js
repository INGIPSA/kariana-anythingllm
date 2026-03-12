const prisma = require("../utils/prisma");
const slugifyModule = require("slugify");
const { v4: uuidv4 } = require("uuid");

const Project = {
  writable: [
    "name",
    "description",
    "defaultAppType",
    "settings",
  ],

  /**
   * Generate a URL-safe slug from a project name.
   * @param {string} name - The project name.
   * @returns {string} The generated slug.
   */
  slugify: function (name) {
    slugifyModule.extend({
      "+": " plus ",
      "!": "",
      "@": " at ",
      "*": "",
      ".": " dot ",
      ":": "",
      "~": "",
      "(": "",
      ")": "",
      "'": "",
      '"': "",
      "|": "",
    });
    return slugifyModule(name, { lower: true, strict: true });
  },

  /**
   * Create a new project.
   * @param {Object} data - The project data.
   * @param {string} data.name - The project name.
   * @param {string} [data.description] - The project description.
   * @param {string} [data.defaultAppType] - The default DCC app type.
   * @param {number} [creatorId] - The ID of the creating user.
   * @returns {Promise<{project: Object|null, message: string|null}>}
   */
  new: async function (data = {}, creatorId = null) {
    const { name, description, defaultAppType } = data;
    if (!name) return { project: null, message: "name cannot be null" };

    let slug = this.slugify(name);
    slug = slug || uuidv4();

    const existingBySlug = await this.get({ slug });
    if (existingBySlug !== null) {
      const slugSeed = Math.floor(10000000 + Math.random() * 90000000);
      slug = this.slugify(`${name}-${slugSeed}`);
    }

    try {
      const project = await prisma.projects.create({
        data: {
          name: String(name).slice(0, 255),
          slug,
          description: description || "",
          defaultAppType: defaultAppType || null,
          settings: "{}",
          createdBy: creatorId,
        },
      });
      return { project, message: null };
    } catch (error) {
      console.error(error.message);
      return { project: null, message: error.message };
    }
  },

  /**
   * Update a project.
   * @param {number} id - The project ID.
   * @param {Object} updates - The fields to update.
   * @returns {Promise<{project: Object|null, message: string|null}>}
   */
  update: async function (id = null, updates = {}) {
    if (!id) throw new Error("No project id provided for update");

    const validUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (this.writable.includes(key)) {
        validUpdates[key] = value;
      }
    }

    if (Object.keys(validUpdates).length === 0)
      return { project: { id }, message: "No valid fields to update!" };

    validUpdates.lastUpdatedAt = new Date();

    try {
      const project = await prisma.projects.update({
        where: { id },
        data: validUpdates,
      });
      return { project, message: null };
    } catch (error) {
      console.error(error.message);
      return { project: null, message: error.message };
    }
  },

  /**
   * Get a single project by clause.
   * @param {Object} clause - Prisma where clause.
   * @returns {Promise<Object|null>}
   */
  get: async function (clause = {}) {
    try {
      const project = await prisma.projects.findFirst({
        where: clause,
        include: {
          project_connections: true,
          project_workspaces: {
            include: {
              workspace: true,
            },
          },
        },
      });
      return project;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  /**
   * Get all projects matching a clause.
   * @param {Object} clause - Prisma where clause.
   * @param {number|null} limit - Optional limit.
   * @param {Object|null} orderBy - Optional ordering.
   * @returns {Promise<Array>}
   */
  where: async function (clause = {}, limit = null, orderBy = null) {
    try {
      const results = await prisma.projects.findMany({
        where: clause,
        ...(limit !== null ? { take: limit } : {}),
        ...(orderBy !== null ? { orderBy } : {}),
        include: {
          project_connections: true,
          project_workspaces: true,
        },
      });
      return results;
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },

  /**
   * Get all projects.
   * @returns {Promise<Array>}
   */
  getAll: async function () {
    return await this.where({}, null, { createdAt: "desc" });
  },

  /**
   * Delete a project by clause.
   * @param {Object} clause - Prisma where clause.
   * @returns {Promise<boolean>}
   */
  delete: async function (clause = {}) {
    try {
      await prisma.projects.delete({
        where: clause,
      });
      return true;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  },

  /**
   * Count projects matching a clause.
   * @param {Object} clause - Prisma where clause.
   * @returns {Promise<number>}
   */
  count: async function (clause = {}) {
    try {
      return await prisma.projects.count({ where: clause });
    } catch (error) {
      console.error(error.message);
      return 0;
    }
  },

  // ---- Connection linking ----

  /**
   * Link a DCC connection to a project.
   * @param {number} projectId
   * @param {number} connectionId
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  addConnection: async function (projectId, connectionId) {
    try {
      await prisma.project_connections.create({
        data: { projectId, connectionId },
      });
      return { success: true, error: null };
    } catch (error) {
      // Unique constraint violation means it's already linked
      if (error.code === "P2002")
        return { success: true, error: null };
      console.error(error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Unlink a DCC connection from a project.
   * @param {number} projectId
   * @param {number} connectionId
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  removeConnection: async function (projectId, connectionId) {
    try {
      await prisma.project_connections.deleteMany({
        where: { projectId, connectionId },
      });
      return { success: true, error: null };
    } catch (error) {
      console.error(error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all connection IDs for a project.
   * @param {number} projectId
   * @returns {Promise<Array>}
   */
  getConnections: async function (projectId) {
    try {
      const links = await prisma.project_connections.findMany({
        where: { projectId },
      });
      return links;
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },

  // ---- Workspace linking ----

  /**
   * Link a workspace to a project.
   * @param {number} projectId
   * @param {number} workspaceId
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  addWorkspace: async function (projectId, workspaceId) {
    try {
      await prisma.project_workspaces.create({
        data: { projectId, workspaceId },
      });
      return { success: true, error: null };
    } catch (error) {
      if (error.code === "P2002")
        return { success: true, error: null };
      console.error(error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Unlink a workspace from a project.
   * @param {number} projectId
   * @param {number} workspaceId
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  removeWorkspace: async function (projectId, workspaceId) {
    try {
      await prisma.project_workspaces.deleteMany({
        where: { projectId, workspaceId },
      });
      return { success: true, error: null };
    } catch (error) {
      console.error(error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all workspaces linked to a project (with workspace details).
   * @param {number} projectId
   * @returns {Promise<Array>}
   */
  getWorkspaces: async function (projectId) {
    try {
      const links = await prisma.project_workspaces.findMany({
        where: { projectId },
        include: {
          workspace: true,
        },
      });
      return links;
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },
};

module.exports = { Project };
