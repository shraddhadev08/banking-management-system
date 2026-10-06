"use server";

import { Client, Account, TablesDB, Users } from "node-appwrite";
import { cookies } from "next/headers";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ||
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

const apiKey =
  process.env.NEXT_APPWRITE_KEY ||
  process.env.APPWRITE_KEY;

export async function createSessionClient() {
  if (!endpoint) {
    throw new Error("NEXT_PUBLIC_APPWRITE_ENDPOINT is missing");
  }

  if (!projectId) {
    throw new Error(
      "NEXT_PUBLIC_APPWRITE_PROJECT or NEXT_PUBLIC_APPWRITE_PROJECT_ID is missing"
    );
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId);

  const session = cookies().get("appwrite-session");

  if (!session?.value) {
    throw new Error("No session");
  }

  client.setSession(session.value);

  return {
    get account() {
      return new Account(client);
    },
  };
}

export async function createAdminClient() {
  if (!endpoint) {
    throw new Error("NEXT_PUBLIC_APPWRITE_ENDPOINT is missing");
  }

  if (!projectId) {
    throw new Error(
      "NEXT_PUBLIC_APPWRITE_PROJECT or NEXT_PUBLIC_APPWRITE_PROJECT_ID is missing"
    );
  }

  if (!apiKey) {
    throw new Error(
      "NEXT_APPWRITE_KEY or APPWRITE_KEY is missing"
    );
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return {
    get account() {
      return new Account(client);
    },

    get database() {
      return new TablesDB(client);
    },

    get user() {
      return new Users(client);
    },
  };
}