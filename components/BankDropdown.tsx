"use client";

import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";

import { formUrlQuery, formatAmount } from "@/lib/utils";

export const BankDropdown = ({
  accounts = [],
  setValue,
  otherStyles,
}: BankDropdownProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selected, setSelected] = useState(accounts[0]);

  useEffect(() => {
    if (accounts.length > 0 && setValue) {
      setValue("senderBank", accounts[0].appwriteItemId);
    }
  }, [accounts, setValue]);

  const handleBankChange = (id: string) => {
    const account = accounts.find(
      (account) => account.appwriteItemId === id
    );

    if (!account) return;

    setSelected(account);

    const newUrl = formUrlQuery({
      params: searchParams.toString(),
      key: "id",
      value: id,
    });

    router.push(newUrl, { scroll: false });

    if (setValue) {
      setValue("senderBank", id);
    }
  };

  if (!selected) return null;

  return (
    <Select
      value={selected.appwriteItemId}
      onValueChange={handleBankChange}
    >
      <SelectTrigger
        className={`flex w-full gap-3 bg-white md:w-[300px] ${otherStyles}`}
      >
        <Image
          src="/icons/credit-card.svg"
          width={20}
          height={20}
          alt="account"
        />

        <p className="line-clamp-1 w-full text-left">
          {selected.name}
        </p>
      </SelectTrigger>

      <SelectContent
        className={`w-full bg-white md:w-[300px] ${otherStyles}`}
        align="end"
      >
        <SelectGroup>
          <SelectLabel className="py-2 font-normal text-gray-500">
            Select a bank to display
          </SelectLabel>

          {accounts.map((account: Account) => (
            <SelectItem
              key={account.appwriteItemId}
              value={account.appwriteItemId}
              className="cursor-pointer border-t"
            >
              <div className="flex flex-col">
                <p className="text-16 font-medium">
                  {account.name}
                </p>

                <p className="text-14 font-medium text-blue-600">
                  {formatAmount(account.currentBalance)}
                </p>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default BankDropdown;