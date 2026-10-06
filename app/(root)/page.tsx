import HeaderBox from '@/components/HeaderBox';
import RecentTransactions from '@/components/RecentTransactions';
import RightSidebar from '@/components/RightSidebar';
import TotalBalanceBox from '@/components/TotalBalanceBox';

import { getAccount, getAccounts } from '@/lib/actions/bank.actions';
import { getLoggedInUser } from '@/lib/actions/user.actions';

const Home = async ({
  searchParams: { id, page },
}: SearchParamProps) => {
  const currentPage = Number(page as string) || 1;

  const loggedIn = await getLoggedInUser();

  if (!loggedIn) {
    return <div>Please sign in.</div>;
  }

  const accounts = await getAccounts({
    userId: loggedIn.$id,
  });

  if (!accounts) {
    return <div>Loading...</div>;
  }

  const accountsData = accounts.data || [];

  const appwriteItemId =
    (id as string) ||
    (accountsData.length > 0
      ? accountsData[0].appwriteItemId
      : null);

  const account = appwriteItemId
    ? await getAccount({ appwriteItemId })
    : null;

  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header">
          <HeaderBox
            type="greeting"
            title="Welcome"
            user={loggedIn?.firstName || "Guest"}
            subtext="Access and manage your account and transactions efficiently."
          />

          <TotalBalanceBox
            accounts={accountsData}
            totalBanks={accounts?.totalBanks || 0}
            totalCurrentBalance={accounts?.totalCurrentBalance || 0}
          />
        </header>

        {account && (
          <RecentTransactions
            accounts={accountsData}
            transactions={account?.transactions || []}
            appwriteItemId={appwriteItemId}
            page={currentPage}
          />
        )}
      </div>

      <RightSidebar
        user={loggedIn}
        transactions={account?.transactions || []}
        banks={accountsData?.slice(0, 2) || []}
      />
    </section>
  );
};

export default Home;