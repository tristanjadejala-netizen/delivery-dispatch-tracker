import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

// ✅ UI separated from logic (FastPass styling lives in CSS)
import "../styles/fastpass-createorder.css";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CreateOrder() {
  const nav = useNavigate();

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    customer_name: "",
    customer_contact: "",
    pickup_address: "",
    dropoff_address: "",
    package_type: "Medium Box",
    package_weight: "",
    package_notes: "",
    delivery_date: todayISO(),
    delivery_priority: "NORMAL",
  });

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const canSubmit = useMemo(() => {
    return (
      form.customer_name.trim().length > 0 &&
      form.pickup_address.trim().length > 0 &&
      form.dropoff_address.trim().length > 0 &&
      !loading
    );
  }, [form, loading]);

  async function submit(e, mode = "redirect") {
    e.preventDefault();
    setErr("");
    setOk("");
    setLoading(true);

    try {
      const payload = {
        ...form,
        package_weight: form.package_weight === "" ? null : Number(form.package_weight),
        delivery_priority: (form.delivery_priority || "NORMAL").toUpperCase(),
      };

      const { data } = await api.post("/deliveries", payload);

      const ref = data?.reference_no || "New order";
      setOk(`✅ Order created successfully: ${ref}`);

      if (mode === "redirect") {
        setTimeout(() => nav("/dispatcher"), 700);
      } else {
        setForm((p) => ({
          ...p,
          customer_name: "",
          customer_contact: "",
          dropoff_address: "",
          package_weight: "",
          package_notes: "",
        }));
      }
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Create order failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fp-page">
      <div className="fp-container">
        {/* Header */}
        <div className="fp-header">
          <div>
            <div className="fp-titleRow">
              <h2 className="fp-title">Create Delivery Order</h2>

              {/* Brand accent (visual only) */}
              <span className="fp-badge">FastPass • Dispatch</span>
            </div>

            <div className="fp-subtitle">
              Encode the delivery details. Required fields are marked.
            </div>
          </div>

          <div className="fp-headerActions">
            <button className="fp-btn fp-btnGhost" type="button" onClick={() => nav("/dispatcher")}>
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="fp-card">
          <div className="fp-cardTopbar" />

          <div className="fp-cardBody">
            <form onSubmit={(e) => submit(e, "redirect")}>
              <div className="fp-grid">
                {/* Customer */}
                <div className="fp-field">
                  <div className="fp-labelRow">
                    <div className="fp-label">Customer Name</div>
                    <div className="fp-meta fp-required">Required</div>
                  </div>
                  <input
                    className="fp-control"
                    placeholder="e.g., Juan Dela Cruz"
                    value={form.customer_name}
                    onChange={(e) => setField("customer_name", e.target.value)}
                  />
                </div>

                <div className="fp-field">
                  <div className="fp-labelRow">
                    <div className="fp-label">Customer Contact</div>
                    <div className="fp-meta fp-optional">Optional</div>
                  </div>
                  <input
                    className="fp-control"
                    placeholder="e.g., 09xxxxxxxxx"
                    value={form.customer_contact}
                    onChange={(e) => setField("customer_contact", e.target.value)}
                  />
                </div>

                {/* Addresses */}
                <div className="fp-field">
                  <div className="fp-labelRow">
                    <div className="fp-label">Pickup Address</div>
                    <div className="fp-meta fp-required">Required</div>
                  </div>
                  <input
                    className="fp-control"
                    placeholder="e.g., Tagbilaran City"
                    value={form.pickup_address}
                    onChange={(e) => setField("pickup_address", e.target.value)}
                  />
                </div>

                <div className="fp-field">
                  <div className="fp-labelRow">
                    <div className="fp-label">Dropoff Address</div>
                    <div className="fp-meta fp-required">Required</div>
                  </div>
                  <input
                    className="fp-control"
                    placeholder="e.g., Baclayon, Bohol"
                    value={form.dropoff_address}
                    onChange={(e) => setField("dropoff_address", e.target.value)}
                  />
                </div>

                {/* Scheduling */}
                <div className="fp-field">
                  <div className="fp-labelRow">
                    <div className="fp-label">Delivery Date</div>
                    <div className="fp-meta fp-optional">Optional</div>
                  </div>
                  <input
                    type="date"
                    className="fp-control"
                    value={form.delivery_date}
                    onChange={(e) => setField("delivery_date", e.target.value)}
                  />
                  <div className="fp-hint">Tip: set date if you need scheduled deliveries.</div>
                </div>

                <div className="fp-field">
                  <div className="fp-labelRow">
                    <div className="fp-label">Priority</div>
                    <div className="fp-meta fp-optional">Optional</div>
                  </div>
                  <select
                    className="fp-control"
                    value={form.delivery_priority}
                    onChange={(e) => setField("delivery_priority", e.target.value)}
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                  <div className="fp-hint">Use URGENT for high-priority deliveries.</div>
                </div>

                {/* Package */}
                <div className="fp-field">
                  <div className="fp-labelRow">
                    <div className="fp-label">Package Type</div>
                    <div className="fp-meta fp-optional">Optional</div>
                  </div>
                  <select
                    className="fp-control"
                    value={form.package_type}
                    onChange={(e) => setField("package_type", e.target.value)}
                  >
                    <option value="Document">Document</option>
                    <option value="Small Box">Small Box</option>
                    <option value="Medium Box">Medium Box</option>
                    <option value="Large Box">Large Box</option>
                  </select>
                </div>

                <div className="fp-field">
                  <div className="fp-labelRow">
                    <div className="fp-label">Package Weight (kg)</div>
                    <div className="fp-meta fp-optional">Optional</div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="fp-control"
                    placeholder="e.g., 5"
                    value={form.package_weight}
                    onChange={(e) => setField("package_weight", e.target.value)}
                  />
                </div>

                <div className="fp-field fp-fieldWide">
                  <div className="fp-labelRow">
                    <div className="fp-label">Package Notes</div>
                    <div className="fp-meta fp-optional">Optional</div>
                  </div>
                  <textarea
                    className="fp-textarea"
                    placeholder="e.g., Handle with care, call upon arrival..."
                    value={form.package_notes}
                    onChange={(e) => setField("package_notes", e.target.value)}
                  />
                </div>
              </div>

              {err ? <div className="fp-alert fp-alertErr">{err}</div> : null}
              {ok ? <div className="fp-alert fp-alertOk">{ok}</div> : null}

              <div className="fp-divider" />

              <div className="fp-footer">
                <div className="fp-requiredNote">
                  Required: <b className="fp-strong">Customer Name</b>,{" "}
                  <b className="fp-strong">Pickup</b>,{" "}
                  <b className="fp-strong">Dropoff</b>
                </div>

                <div className="fp-actions">
                  <button
                    type="button"
                    className="fp-btn fp-btnGhost"
                    onClick={() =>
                      setForm({
                        customer_name: "",
                        customer_contact: "",
                        pickup_address: "",
                        dropoff_address: "",
                        package_type: "Medium Box",
                        package_weight: "",
                        package_notes: "",
                        delivery_date: todayISO(),
                        delivery_priority: "NORMAL",
                      })
                    }
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className="fp-btn fp-btnSecondary"
                    disabled={!canSubmit}
                    onClick={(e) => submit(e, "new")}
                  >
                    {loading ? "Creating..." : "Create & New"}
                  </button>

                  <button type="submit" className="fp-btn fp-btnPrimary" disabled={!canSubmit}>
                    {loading ? "Creating..." : "Create Order"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="fp-spacer" />
      </div>
    </div>
  );
}
