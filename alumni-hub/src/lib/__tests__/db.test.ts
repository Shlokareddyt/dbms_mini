import { describe, expect, it } from "vitest";
import { AppHttpError, mapDatabaseError } from "@/lib/db";

describe("mapDatabaseError", () => {
  it("maps a duplicate-email UNIQUE violation to a friendly 409", () => {
    const mapped = mapDatabaseError({
      code: "ER_DUP_ENTRY",
      errno: 1062,
      sqlMessage: "Duplicate entry 'a@b.com' for key 'users.email'",
    });
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe("ER_DUP_ENTRY");
    expect(mapped.message).toMatch(/email/i);
  });

  it("maps the chk_alumni_mentee_capacity CHECK violation to a 409 explaining capacity", () => {
    const mapped = mapDatabaseError({
      code: "ER_CHECK_CONSTRAINT_VIOLATED",
      errno: 3819,
      sqlMessage: "Check constraint 'chk_alumni_mentee_capacity' is violated.",
    });
    expect(mapped.status).toBe(409);
    expect(mapped.message).toMatch(/capacity/i);
  });

  it("maps a missing foreign key parent row to a 400", () => {
    const mapped = mapDatabaseError({ code: "ER_NO_REFERENCED_ROW_2", errno: 1452 });
    expect(mapped.status).toBe(400);
  });

  it("maps connection-refused errors to a 503 so the client can distinguish outages from bad input", () => {
    const mapped = mapDatabaseError({ code: "ECONNREFUSED" });
    expect(mapped.status).toBe(503);
  });

  it("passes AppHttpError through with its own status/code", () => {
    const mapped = mapDatabaseError(new AppHttpError("Custom message", 418, "TEAPOT"));
    expect(mapped.status).toBe(418);
    expect(mapped.code).toBe("TEAPOT");
    expect(mapped.message).toBe("Custom message");
  });

  it("falls back to a 500 for anything unrecognized", () => {
    const mapped = mapDatabaseError(new Error("something exploded"));
    expect(mapped.status).toBe(500);
  });
});
