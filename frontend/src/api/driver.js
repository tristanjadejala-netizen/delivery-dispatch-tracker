// frontend/src/api/driver.js
import api from "../lib/api";

export async function fetchDriverDeliveries() {
  const res = await api.get("/driver/deliveries");
  const rows = Array.isArray(res?.data?.rows)
    ? res.data.rows
    : Array.isArray(res?.data)
    ? res.data
    : [];
  return rows;
}

export function updateDriverDeliveryStatus(deliveryId, { status, note }) {
  return api.post(`/driver/deliveries/${deliveryId}/status`, {
    status,
    note: note || null,
  });
}

export function submitDriverPOD(deliveryId, formData) {
  return api.post(`/driver/deliveries/${deliveryId}/pod`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function submitDriverFail(deliveryId, formData) {
  return api.post(`/driver/deliveries/${deliveryId}/fail`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function submitDriverEmergency(deliveryId, payload) {
  return api.post(`/driver/deliveries/${deliveryId}/emergency`, payload);
}
