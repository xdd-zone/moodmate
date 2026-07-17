import { and, asc, desc, eq, ne } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";

import { applications, roles } from "@/modules/auth/auth.schema";

export async function findRoleList(database: D1Database | undefined) {
  const db = createD1Client(database);

  return db
    .select({
      applicationCode: applications.code,
      code: roles.code,
      createdAtMs: roles.createdAtMs,
      deletedAtMs: roles.deletedAtMs,
      disabledAtMs: roles.disabledAtMs,
      id: roles.id,
      name: roles.name,
      status: roles.status,
      updatedAtMs: roles.updatedAtMs,
    })
    .from(roles)
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .where(ne(roles.status, "deleted"))
    .orderBy(asc(applications.code), desc(roles.createdAtMs), desc(roles.id));
}

export async function findActiveApplication(
  database: D1Database | undefined,
  code: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.code, code), eq(applications.status, "active")))
    .limit(1);

  return rows[0] ?? null;
}

export async function findRoleByApplicationAndCode(
  database: D1Database | undefined,
  applicationId: string,
  code: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.applicationId, applicationId), eq(roles.code, code)))
    .limit(1);

  return rows[0] ?? null;
}

export async function findRoleById(
  database: D1Database | undefined,
  roleId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      applicationCode: applications.code,
      code: roles.code,
      createdAtMs: roles.createdAtMs,
      deletedAtMs: roles.deletedAtMs,
      disabledAtMs: roles.disabledAtMs,
      id: roles.id,
      name: roles.name,
      status: roles.status,
      updatedAtMs: roles.updatedAtMs,
    })
    .from(roles)
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .where(and(eq(roles.id, roleId), ne(roles.status, "deleted")))
    .limit(1);

  return rows[0] ?? null;
}

export async function insertRole(input: {
  applicationId: string;
  code: string;
  database: D1Database | undefined;
  name: string;
  nowMs: number;
}) {
  const db = createD1Client(input.database);
  const id = uuidv7();

  await db.insert(roles).values({
    applicationId: input.applicationId,
    code: input.code,
    createdAtMs: input.nowMs,
    id,
    name: input.name,
    status: "active",
    updatedAtMs: input.nowMs,
  });

  return id;
}

export async function updateRoleStatus(input: {
  database: D1Database | undefined;
  roleId: string;
  status: "disabled" | "deleted";
  nowMs: number;
}) {
  const db = createD1Client(input.database);
  const timestampFields =
    input.status === "disabled"
      ? { disabledAtMs: input.nowMs }
      : { deletedAtMs: input.nowMs };

  await db
    .update(roles)
    .set({
      ...timestampFields,
      status: input.status,
      updatedAtMs: input.nowMs,
    })
    .where(eq(roles.id, input.roleId));
}
