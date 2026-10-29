import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, headersFile, pbOrigin, securityHeaders } from "../../security-headers";

describe("заголовки безопасности фронтенда (C-6 / D-8)", () => {
  it("CSP без unsafe-eval и без unsafe-inline в скриптах, с запретом встраивания и плагинов", () => {
    const csp = contentSecurityPolicy("https://pb.example.test/");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it("адрес PocketBase попадает в connect-src, img-src и media-src и только как origin", () => {
    const csp = contentSecurityPolicy("https://pb.example.test/some/path?x=1");
    expect(csp).toContain("connect-src 'self' https://pb.example.test;");
    expect(csp).toMatch(/img-src [^;]*https:\/\/pb\.example\.test/);
    expect(csp).toMatch(/media-src [^;]*https:\/\/pb\.example\.test/);
    expect(csp).not.toContain("/some/path");
  });

  it("пустой адрес = тот же origin, мусорный адрес = локальный PocketBase по умолчанию", () => {
    expect(pbOrigin("")).toBe("");
    expect(pbOrigin(undefined)).toBe("");
    expect(contentSecurityPolicy("")).toContain("connect-src 'self';");
    expect(pbOrigin("не адрес")).toBe("http://127.0.0.1:8090");
  });

  it("остальные заголовки и файл _headers для Cloudflare Pages", () => {
    const h = securityHeaders("https://pb.example.test");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("microphone=(self)");
    const file = headersFile("https://pb.example.test");
    expect(file.startsWith("/*\n")).toBe(true);
    for (const [k, v] of Object.entries(h)) expect(file).toContain(`  ${k}: ${v}`);
  });
});
