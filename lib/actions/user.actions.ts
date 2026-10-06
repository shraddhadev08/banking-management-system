"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { cookies } from "next/headers";
import {
  encryptId,
  extractCustomerIdFromUrl,
  parseStringify,
} from "../utils";
import {
  CountryCode,
  Products,
  ProcessorTokenCreateRequestProcessorEnum,
} from "plaid";
import { plaidClient } from "@/lib/plaid";
import { revalidatePath } from "next/cache";
import {
  addFundingSource,
  createDwollaCustomer,
} from "./dwolla.actions";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  try {
    const { database } = await createAdminClient();

    const user = await database.listRows(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal("userId", [userId])]
    );

    return parseStringify(user.rows[0]);
  } catch (error) {
    console.log(error);
  }
};

export const signIn = async ({ email, password }: signInProps) => {
  try {
    const { account } = await createAdminClient();

    const session = await account.createEmailPasswordSession(
      email,
      password
    );

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    const user = await getUserInfo({
      userId: session.userId,
    });

    return parseStringify(user);
  } catch (error) {
    console.error("Error", error);
  }
};

export const signUp = async ({
  password,
  ...userData
}: SignUpParams) => {
  const { email, firstName, lastName } = userData;

  let newUserAccount;

  try {
    const { account, database } = await createAdminClient();

    newUserAccount = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    );

    if (!newUserAccount) {
      throw new Error("Error creating user");
    }

    const dwollaCustomerUrl = await createDwollaCustomer({
      ...userData,
      type: "personal",
    });

    if (!dwollaCustomerUrl) {
      throw new Error("Error creating Dwolla customer");
    }

    const dwollaCustomerId =
      extractCustomerIdFromUrl(dwollaCustomerUrl);

    const newUser = await database.createRow(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      ID.unique(),
      {
        ...userData,
        userId: newUserAccount.$id,
        dwollaCustomerId,
        dwollaCustomerUrl,
      }
    );

    const session = await account.createEmailPasswordSession(
      email,
      password
    );

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    return parseStringify(newUser);
  } catch (error) {
    console.error("Error", error);
  }
};

export async function getLoggedInUser() {
  try {
    const { account } = await createSessionClient();

    const result = await account.get();

    const user = await getUserInfo({
      userId: result.$id,
    });

    return parseStringify(user);
  } catch (error) {
    console.log(error);
    return null;
  }
}

export const logoutAccount = async () => {
  try {
    const { account } = await createSessionClient();

    cookies().delete("appwrite-session");

    await account.deleteSession("current");
  } catch (error) {
    return null;
  }
};

export const createLinkToken = async (user: User) => {
  try {
    const tokenParams = {
  user: {
    client_user_id: user.$id,
  },
  client_name: `${user.firstName} ${user.lastName}`,
  products: ["auth", "transactions"] as Products[],
  language: "en",
  country_codes: ["US"] as CountryCode[],
};

    const response = await plaidClient.linkTokenCreate(tokenParams);

    return parseStringify({
      linkToken: response.data.link_token,
    });
  } catch (error) {
    console.log(error);
  }
};

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    const bankAccount = await database.createRow(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    );

    return parseStringify(bankAccount);
  } catch (error) {
    console.log(error);
  }
};

export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    // Exchange public token for access token and item ID
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    console.log("STEP 1: Public token exchanged");
    console.log("Access Token:", accessToken ? "FOUND" : "MISSING");
    console.log("Item ID:", itemId);

    // Get account information from Plaid using the access token
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    console.log("STEP 2: Account fetched");
    console.log(accountsResponse.data.accounts);

    const accountData = accountsResponse.data.accounts[0];

const request = {
  access_token: accessToken,
  account_id: accountData.account_id,
  processor: ProcessorTokenCreateRequestProcessorEnum.Dwolla,
};

console.log("Creating processor token...");

const processorTokenResponse =
  await plaidClient.processorTokenCreate(request);

const processorToken =
  processorTokenResponse.data.processor_token;

console.log("Processor Token:", processorToken);

const fundingSourceUrl = await addFundingSource({
  dwollaCustomerId: extractCustomerIdFromUrl(
    user.dwollaCustomerUrl
  ),
  processorToken,
  bankName: accountData.name,
});

    console.log("STEP 4: Funding source created");
    console.log("Funding Source URL:", fundingSourceUrl);

    if (!fundingSourceUrl) {
      throw new Error("Error creating funding source");
    }

    console.log("STEP 5: Saving bank account");

    // Save the bank account in Appwrite
    await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: encryptId(accountData.account_id),
    });

    console.log("STEP 6: SUCCESS");

    revalidatePath("/");

    return parseStringify({
      publicTokenExchange: "complete",
    });
  } catch (error) {
    console.error(
      "An error occurred while exchanging token:",
      error
    );
  }
};

export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const banks = await database.listRows(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal("userId", [userId])]
    );

    return parseStringify(banks.rows);
  } catch (error) {
    console.log(error);
  }
};
export const getBank = async ({ documentId }: getBankProps) => {
  try {
    console.log("getBank() called with documentId:", documentId);

    if (!documentId) {
      console.error("documentId is missing!");
      return null;
    }

    const { database } = await createAdminClient();

    const bank = await database.listRows(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal("$id", [documentId])]
    );

    console.log("Bank query result:", bank);

    return parseStringify(bank.rows[0]);
  } catch (error) {
    console.log(error);
    return null;
  }
};
export const getBankByAccountId = async ({
  accountId,
}: {
  accountId: string;
}) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listRows(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal("accountId", [accountId])]
    );

    return parseStringify(bank.rows[0]);
  } catch (error) {
    console.log(error);
    return null;
  }
};