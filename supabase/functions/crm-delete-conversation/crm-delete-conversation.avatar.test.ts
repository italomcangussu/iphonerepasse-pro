const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test("lead deletion removes the stored avatar best-effort before deleting the lead", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const lookupIndex = source.indexOf('.select("avatar_storage_path")');
  const cleanupIndex = source.indexOf("await removeStoredLeadAvatar(");
  const leadDeleteIndex = source.indexOf('.from("crm_leads")\n    .delete()');

  assert(source.includes('from "../_shared/uazLeadAvatar.ts"'), "shared avatar cleanup import missing");
  assert(lookupIndex >= 0, "avatar storage path lookup missing");
  assert(cleanupIndex > lookupIndex, "avatar cleanup must follow path lookup");
  assert(leadDeleteIndex > cleanupIndex, "avatar cleanup must run before lead deletion");
  assert(source.includes("avatar_removed: avatarRemoved"), "cleanup outcome must be audited");
});
