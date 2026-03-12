import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const DCCConnection = {
  getAll: async function () {
    return await fetch(`${API_BASE}/v1/dcc-connections`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch DCC connections.");
        return res.json();
      })
      .then((res) => res.connections || [])
      .catch(() => []);
  },

  get: async function (id) {
    return await fetch(`${API_BASE}/v1/dcc-connections/${id}`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch DCC connection.");
        return res.json();
      })
      .then((res) => res.connection || null)
      .catch(() => null);
  },

  create: async function (data = {}) {
    return await fetch(`${API_BASE}/v1/dcc-connections/new`, {
      method: "POST",
      headers: {
        ...baseHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => ({
        success: false,
        error: e.message,
        connection: null,
      }));
  },

  update: async function (id, data = {}) {
    return await fetch(`${API_BASE}/v1/dcc-connections/${id}/update`, {
      method: "POST",
      headers: {
        ...baseHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => ({
        success: false,
        error: e.message,
        connection: null,
      }));
  },

  delete: async function (id) {
    return await fetch(`${API_BASE}/v1/dcc-connections/${id}`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({
        success: false,
        error: e.message,
      }));
  },

  test: async function (id) {
    return await fetch(`${API_BASE}/v1/dcc-connections/${id}/test`, {
      method: "POST",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({
        success: false,
        error: e.message,
      }));
  },

  connect: async function (id) {
    return await fetch(`${API_BASE}/v1/dcc-connections/${id}/connect`, {
      method: "POST",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({
        success: false,
        error: e.message,
      }));
  },

  disconnect: async function (id) {
    return await fetch(`${API_BASE}/v1/dcc-connections/${id}/disconnect`, {
      method: "POST",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({
        success: false,
        error: e.message,
      }));
  },

  status: async function () {
    return await fetch(`${API_BASE}/v1/dcc-connections/status`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch DCC connection status.");
        return res.json();
      })
      .then((res) => res.connections || [])
      .catch(() => []);
  },

  tools: async function () {
    return await fetch(`${API_BASE}/v1/dcc-connections/tools`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch DCC tools.");
        return res.json();
      })
      .then((res) => res.tools || [])
      .catch(() => []);
  },
};

export default DCCConnection;
