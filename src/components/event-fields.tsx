"use client";

import { CATEGORY_LABELS, EVENT_CATEGORIES, type EventCategory } from "@/lib/types";

export type EventFields = {
  title: string;
  category: EventCategory;
  starts_at_local: string;
  ends_at_local: string;
  venue_name: string;
  address: string;
  city: string;
  lineup: string;
  price: string;
  ticket_url: string;
  description: string;
};

export const EMPTY_EVENT_FIELDS: EventFields = {
  title: "",
  category: "other",
  starts_at_local: "",
  ends_at_local: "",
  venue_name: "",
  address: "",
  city: "",
  lineup: "",
  price: "",
  ticket_url: "",
  description: "",
};

/** The shared set of inputs used when creating and editing an event. */
export function EventFieldInputs({
  fields,
  onChange,
}: {
  fields: EventFields;
  onChange: (next: EventFields) => void;
}) {
  const update =
    (key: keyof EventFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...fields, [key]: e.target.value });

  return (
    <>
      <div>
        <label htmlFor="title" className="field-label">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          value={fields.title}
          onChange={update("title")}
          className="field"
          placeholder="Boiler Room x Warehouse Project"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="starts_at_local" className="field-label">
            Starts
          </label>
          <input
            id="starts_at_local"
            name="starts_at_local"
            type="datetime-local"
            required
            value={fields.starts_at_local}
            onChange={update("starts_at_local")}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="ends_at_local" className="field-label">
            Ends <span className="text-lilac">(optional)</span>
          </label>
          <input
            id="ends_at_local"
            name="ends_at_local"
            type="datetime-local"
            value={fields.ends_at_local}
            onChange={update("ends_at_local")}
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="field-label">
            Type
          </label>
          <select
            id="category"
            name="category"
            value={fields.category}
            onChange={update("category")}
            className="field"
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="price" className="field-label">
            Price
          </label>
          <input
            id="price"
            name="price"
            maxLength={80}
            value={fields.price}
            onChange={update("price")}
            className="field"
            placeholder="$20, free before 11"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="venue_name" className="field-label">
            Venue
          </label>
          <input
            id="venue_name"
            name="venue_name"
            maxLength={120}
            value={fields.venue_name}
            onChange={update("venue_name")}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="city" className="field-label">
            City
          </label>
          <input
            id="city"
            name="city"
            maxLength={80}
            value={fields.city}
            onChange={update("city")}
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="address" className="field-label">
          Address
        </label>
        <input
          id="address"
          name="address"
          maxLength={200}
          value={fields.address}
          onChange={update("address")}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="lineup" className="field-label">
          Lineup <span className="text-lilac">(comma separated)</span>
        </label>
        <input
          id="lineup"
          name="lineup"
          value={fields.lineup}
          onChange={update("lineup")}
          className="field"
          placeholder="Peggy Gou, Fred again.."
        />
      </div>

      <div>
        <label htmlFor="ticket_url" className="field-label">
          Ticket link
        </label>
        <input
          id="ticket_url"
          name="ticket_url"
          inputMode="url"
          maxLength={500}
          value={fields.ticket_url}
          onChange={update("ticket_url")}
          className="field"
          placeholder="ra.co/events/…"
        />
      </div>

      <div>
        <label htmlFor="description" className="field-label">
          About
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          value={fields.description}
          onChange={update("description")}
          className="field resize-y"
        />
      </div>
    </>
  );
}
