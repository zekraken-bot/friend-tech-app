import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [data, setData] = useState([]);
  const [sortedData, setSortedData] = useState([]);
  const [sortedData2, setSortedData2] = useState([]);
  const [timeframe, setTimeframe] = useState("");
  const [initialStartTime] = useState(new Date());
  const [uniqueDataState, setUniqueDataState] = useState([]);

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
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

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

        newDataMap[name] = newDataMap[name] || { count: 0, ethAmount: 0 };
        newDataMap[name].count += 1;
        newDataMap[name].ethAmount += ethAmount;

        const trader = event.trader.name;

        newDataMap2[trader] = newDataMap2[trader] || { count: 0, ethAmount: 0 };
        newDataMap2[trader].count += 1;
        newDataMap2[trader].ethAmount += ethAmount;
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

    // If more than 5 minutes have passed since initialStartTime, roll forward by 15 seconds
    if (now - initialStartTime.getTime() > 5 * 60 * 1000) {
      adjustedStartTime = new Date(endTime.getTime() - 5 * 60 * 1000);
    } else {
      adjustedStartTime = initialStartTime;
    }
    setTimeframe(`${adjustedStartTime.toLocaleString()} - ${endTime.toLocaleString()}`);
    // eslint-disable-next-line
  }, [uniqueDataState]);
  return (
    <div className="App">
      <h1>Friend.Tech Rolling 5 Minute Global Data</h1>
      <h2>
        Timeframe: {timeframe} | updates every 15secs | created by{" "}
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
              <th>Total ETH Purchased</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map(([name, data], index) => (
              <tr key={index}>
                <td>{name}</td>
                <td>{data.count}</td>
                <td>{parseFloat(data.ethAmount).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="data-table">
          <thead>
            <tr>
              <th>Top 25 Trader Names</th>
              <th>Count</th>
              <th>Total ETH spent</th>
            </tr>
          </thead>
          <tbody>
            {sortedData2.map(([trader, data2], index) => (
              <tr key={index}>
                <td>{trader}</td>
                <td>{data2.count}</td>
                <td>{parseFloat(data2.ethAmount).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
