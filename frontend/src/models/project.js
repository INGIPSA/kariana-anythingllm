import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Project = {
  /**
   * Get all projects.
   * @returns {Promise<Array>}
   */
  getAll: async function () {
    return await fetch(`${API_BASE}/v1/projects`, {
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res.projects || [])
      .catch(() => []);
  },

  /**
   * Get a single project by ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  get: async function (id) {
    return await fetch(`${API_BASE}/v1/projects/${id}`, {
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res.project || null)
      .catch(() => null);
  },

  /**
   * Create a new project.
   * @param {Object} data - { name, description, defaultAppType }
   * @returns {Promise<{project: Object|null, message: string|null}>}
   */
  create: async function (data = {}) {
    return await fetch(`${API_BASE}/v1/projects/new`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch(() => ({ project: null, message: "Failed to create project" }));
  },

  /**
   * Update a project.
   * @param {number} id
   * @param {Object} updates
   * @returns {Promise<{project: Object|null, message: string|null}>}
   */
  update: async function (id, updates = {}) {
    return await fetch(`${API_BASE}/v1/projects/${id}/update`, {
      method: "POST",
      body: JSON.stringify(updates),
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch(() => ({ project: null, message: "Failed to update project" }));
  },

  /**
   * Delete a project.
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  delete: async function (id) {
    return await fetch(`${API_BASE}/v1/projects/${id}`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.ok)
      .catch(() => false);
  },

  /**
   * Add a connection to a project.
   * @param {number} projectId
   * @param {number} connectionId
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  addConnection: async function (projectId, connectionId) {
    return await fetch(`${API_BASE}/v1/projects/${projectId}/connections/add`, {
      method: "POST",
      body: JSON.stringify({ connectionId }),
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch(() => ({ success: false, error: "Failed to add connection" }));
  },

  /**
   * Remove a connection from a project.
   * @param {number} projectId
   * @param {number} connectionId
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  removeConnection: async function (projectId, connectionId) {
    return await fetch(
      `${API_BASE}/v1/projects/${projectId}/connections/remove`,
      {
        method: "POST",
        body: JSON.stringify({ connectionId }),
        headers: baseHeaders(),
      }
    )
      .then((res) => res.json())
      .catch(() => ({ success: false, error: "Failed to remove connection" }));
  },

  /**
   * Get all connections for a project.
   * @param {number} projectId
   * @returns {Promise<Array>}
   */
  getConnections: async function (projectId) {
    return await fetch(
      `${API_BASE}/v1/projects/${projectId}/connections`,
      {
        headers: baseHeaders(),
      }
    )
      .then((res) => res.json())
      .then((res) => res.connections || [])
      .catch(() => []);
  },

  /**
   * Add a workspace to a project.
   * @param {number} projectId
   * @param {number} workspaceId
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  addWorkspace: async function (projectId, workspaceId) {
    return await fetch(`${API_BASE}/v1/projects/${projectId}/workspaces/add`, {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch(() => ({ success: false, error: "Failed to add workspace" }));
  },

  /**
   * Remove a workspace from a project.
   * @param {number} projectId
   * @param {number} workspaceId
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  removeWorkspace: async function (projectId, workspaceId) {
    return await fetch(
      `${API_BASE}/v1/projects/${projectId}/workspaces/remove`,
      {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
        headers: baseHeaders(),
      }
    )
      .then((res) => res.json())
      .catch(() => ({ success: false, error: "Failed to remove workspace" }));
  },

  /**
   * Get all workspaces for a project.
   * @param {number} projectId
   * @returns {Promise<Array>}
   */
  getWorkspaces: async function (projectId) {
    return await fetch(
      `${API_BASE}/v1/projects/${projectId}/workspaces`,
      {
        headers: baseHeaders(),
      }
    )
      .then((res) => res.json())
      .then((res) => res.workspaces || [])
      .catch(() => []);
  },
};

export default Project;
