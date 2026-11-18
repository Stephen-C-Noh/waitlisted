import { describe, it, expect } from "vitest";
import { extractPosToken } from "@/lib/spring-boot-client";

describe("extractPosToken", () => {
  it("reads the pos-token cookie, keeping any '=' inside the JWT", () => {
    const request = new Request("http://localhost/api/x", {
      headers: { cookie: "staff-session=abc; pos-token=eyJh.b=c.d==; theme=dark" },
    });
    expect(extractPosToken(request)).toBe("eyJh.b=c.d==");
  });
});
