import React, { useState, useEffect } from "react";
import "./App.css";
import { ethers } from "ethers";

function App() {
  const [data, setData] = useState([]);
  const [sortedData, setSortedData] = useState([]);
  const [sortedData2, setSortedData2] = useState([]);
  const [timeframe, setTimeframe] = useState("");
  const [initialStartTime] = useState(new Date());
  const [uniqueDataState, setUniqueDataState] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [addressToBalance, setAddressToBalance] = useState({});
  const [lastFetchedAddresses, setLastFetchedAddresses] = useState(new Set());
  const [addressToPortfolioValue, setAddressToPortfolioValue] = useState({});
  const [addressToDisplayPrice, setAddressToDisplayPrice] = useState({});

  const fetchBalances = async () => {
    const provider = new ethers.providers.JsonRpcProvider("https://1rpc.io/base");

    // Get a unique set of addresses
    const allAddresses = [...new Set(uniqueDataState.map((event) => event.subject.address)), ...new Set(uniqueDataState.map((event) => event.trader.address))];

    const newAddresses = allAddresses.filter((address) => !lastFetchedAddresses.has(address));

    if (newAddresses.length === 0) {
      // No new addresses to fetch balances for
      return;
    }

    const balances = await Promise.all(newAddresses.map((address) => provider.getBalance(address)));

    // Convert big number balances to ether and map to addresses
    const updatedAddressToBalance = { ...addressToBalance }; // Copy previous balances
    newAddresses.forEach((address, index) => {
      updatedAddressToBalance[address] = ethers.utils.formatEther(balances[index]);
    });

    setAddressToBalance(updatedAddressToBalance);

    // Update last fetched addresses set
    setLastFetchedAddresses(new Set(allAddresses));
  };

  const fetchPortfolioValues = async () => {
    const subjectAddresses = sortedData.map(([name, data]) => data.address);
    const traderAddresses = sortedData2.map(([name, data]) => data.address);
    const allAddresses = [...new Set([...subjectAddresses, ...traderAddresses])];

    const fetchDataForAddress = async (address) => {
      const walletInfoResponse = await fetch(`https://prod-api.kosetto.com/wallet-info/${address}`);
      const walletInfoJson = await walletInfoResponse.json();

      const userResponse = await fetch(`https://prod-api.kosetto.com/users/${address}`);
      const userJson = await userResponse.json();

      //console.log(address, ",", walletInfoJson);
      return {
        portfolioValue: walletInfoJson.portfolioValue / 10 ** 18,
        displayPrice: userJson.displayPrice / 10 ** 18,
      };
    };

    // Fetch all data simultaneously using Promise.all
    const allData = await Promise.all(allAddresses.map((address) => fetchDataForAddress(address)));

    const updatedAddressToPortfolioValue = { ...addressToPortfolioValue }; // Initialize this variable
    const updatedAddressToDisplayPrice = { ...addressToDisplayPrice };

    allAddresses.forEach((address, index) => {
      updatedAddressToPortfolioValue[address] = allData[index].portfolioValue;
      updatedAddressToDisplayPrice[address] = allData[index].displayPrice;
    });

    setAddressToPortfolioValue(updatedAddressToPortfolioValue);
    setAddressToDisplayPrice(updatedAddressToDisplayPrice);
  };

  const fetchData = async () => {
    try {
      const response = await fetch("https://proxyglobalactivity.zekraken00.workers.dev/");
      const jsonData = await response.json();

      setData((prevData) => [...prevData, ...jsonData.events]);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  function filterDuplicates(events) {
    const uniqueEvents = [];
    const seenCombinations = new Set();

    for (const event of events) {
      const combination = `${event.createdAt}-${event.subject.name}`;
      if (!seenCombinations.has(combination)) {
        seenCombinations.add(combination);
        uniqueEvents.push(event);
      }
    }

    return uniqueEvents;
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchBalances();
    // eslint-disable-next-line
  }, [data]);

  useEffect(() => {
    fetchPortfolioValues();
    // eslint-disable-next-line
  }, [sortedData, sortedData2]);

  useEffect(() => {
    const uniqueData = filterDuplicates(data);
    setUniqueDataState(uniqueData);
  }, [data]);

  useEffect(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    let newDataMap = {};
    let newDataMap2 = {};

    uniqueDataState.forEach((event) => {
      if (event.isBuy && event.createdAt > fiveMinutesAgo) {
        const name = event.subject.name;
        const ethAmount = event.ethAmount / 10 ** 18;
        const susername = event.subject.username;

        newDataMap[name] = newDataMap[name] || { count: 0, ethAmount: 0 };
        newDataMap[name].address = event.subject.address;
        newDataMap[name].count += 1;
        newDataMap[name].ethAmount += ethAmount;
        newDataMap[name].ethPrice = ethAmount;
        newDataMap[name].susername = susername;
        newDataMap[name].balance = parseFloat(addressToBalance[event.subject.address] || 0);

        const trader = event.trader.name;
        const tusername = event.trader.username;

        newDataMap2[trader] = newDataMap2[trader] || { count: 0, ethAmount: 0 };
        newDataMap2[trader].address = event.trader.address;
        newDataMap2[trader].count += 1;
        newDataMap2[trader].ethAmount += ethAmount;
        newDataMap2[trader].tusername = tusername;
        newDataMap2[trader].balance2 = parseFloat(addressToBalance[event.trader.address] || 0);
      }
    });

    // Sort the data primarily by count, then by ethAmount
    const sorted = Object.entries(newDataMap).sort((a, b) => b[1].count - a[1].count || b[1].ethAmount - a[1].ethAmount);
    const sorted2 = Object.entries(newDataMap2).sort((a, b) => b[1].count - a[1].count || b[1].ethAmount - a[1].ethAmount);

    // Limit the sorted data to the top 25
    const top25 = sorted.slice(0, 25);
    const top25_2 = sorted2.slice(0, 25);

    setSortedData(top25);

    setSortedData2(top25_2);

    console.log(uniqueDataState);

    // Adjusted timeframe calculation
    const endTime = new Date();
    let adjustedStartTime;

    // If more than 5 minutes have passed since initialStartTime, roll forward by 30 seconds
    if (now - initialStartTime.getTime() > 5 * 60 * 1000) {
      adjustedStartTime = new Date(endTime.getTime() - 5 * 60 * 1000 + 30 * 1000); // Add 30 seconds
    } else {
      adjustedStartTime = initialStartTime;
    }
    setTimeframe(`${adjustedStartTime.toLocaleString()} - ${endTime.toLocaleString()}`);

    // eslint-disable-next-line
  }, [uniqueDataState]);
  return (
    <div className={`App ${darkMode ? "dark-mode" : ""}`}>
      <div>
        <button onClick={() => setDarkMode(!darkMode)}>Toggle {darkMode ? "Light" : "Dark"} Mode</button>
      </div>
      <h1>Friend.Tech Rolling 5 Minute Global Data</h1>
      <h2>
        Timeframe: {timeframe} | updates every 30secs | created by{" "}
        <a href="https://twitter.com/The_Krake" target="_blank" rel="noopener noreferrer">
          @ZeKraken
        </a>
      </h2>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Top 25 Names Purchased</th>
              <th>Count</th>
              <th>Total Purchased Ξ</th>
              <th>Key Price Ξ</th>
              <th>Port Value Ξ</th>
              <th>Wallet Bal Ξ</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map(([name, data], index) => (
              <tr key={index}>
                <td>
                  <a href={`https://basescan.org/address/${data.address}`} target="_blank" rel="noopener noreferrer">
                    {name}
                  </a>{" "}
                  <a href={`https://www.friend.tech/rooms/${data.address}`} target="_blank" rel="noopener noreferrer">
                    <button className="small-button">🔗</button>
                  </a>
                  {""}
                  <a href={`https://twitter.com/${data.susername}`} target="_blank" rel="noopener noreferrer">
                    <button className="small-button">🕊️</button>
                  </a>
                </td>
                <td>{data.count}</td>
                <td>{parseFloat(data.ethAmount).toFixed(4)}</td>
                <td>{parseFloat(data.ethPrice).toFixed(4)}</td>
                <td>{parseFloat(addressToPortfolioValue[data.address] || 0).toFixed(4)}</td>
                <td className={data.balance > 5 ? "high-balance" : ""}>{parseFloat(data.balance).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="data-table">
          <thead>
            <tr>
              <th>Top 25 Trader Names</th>
              <th>Count</th>
              <th>Total Spent Ξ</th>
              <th>Key Price Ξ</th>
              <th>Port Value Ξ</th>
              <th>Wallet Bal Ξ</th>
            </tr>
          </thead>
          <tbody>
            {sortedData2.map(([trader, data2], index) => (
              <tr key={index}>
                <td>
                  <a href={`https://basescan.org/address/${data2.address}`} target="_blank" rel="noopener noreferrer">
                    {trader}
                  </a>{" "}
                  <a href={`https://www.friend.tech/rooms/${data2.address}`} target="_blank" rel="noopener noreferrer">
                    <button className="small-button">🔗</button>
                  </a>
                  {""}
                  <a href={`https://twitter.com/${data2.susername}`} target="_blank" rel="noopener noreferrer">
                    <button className="small-button">🕊️</button>
                  </a>
                </td>
                <td>{data2.count}</td>
                <td>{parseFloat(data2.ethAmount).toFixed(4)}</td>
                <td>{parseFloat(addressToDisplayPrice[data2.address] || 0).toFixed(4)}</td>
                <td>{parseFloat(addressToPortfolioValue[data2.address] || 0).toFixed(4)}</td>
                <td className={data2.balance2 > 5 ? "high-balance" : ""}>{parseFloat(data2.balance2).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
