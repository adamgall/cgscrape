import axios from 'axios';
import fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

// Define a type for our coin data
type CoinData = {
  id: string;
  name: string;
  symbol: string;
  price1: number;
  price2: number;
  percentageChange: number;
  marketCap1: number;
  volume1: number;
  marketCap2: number;
  volume2: number;
};

// Prepare the CSV writer
const csvWriter = (inputFilename: string) => createObjectCsvWriter({
  path: `out/${inputFilename}_out.csv`,
  header: [
    { id: 'id', title: 'ID' },
    { id: 'name', title: 'Name' },
    { id: 'symbol', title: 'Symbol' },
    { id: 'price1', title: 'Price 31-03-2022 (USD)' },
    { id: 'marketCap1', title: 'Market Cap 31-03-2022 (USD)' },
    { id: 'volume1', title: 'Trading Volume 31-03-2022 (USD)' },
    { id: 'price2', title: 'Price 24-04-2023 (USD)' },
    { id: 'marketCap2', title: 'Market Cap 24-04-2023 (USD)' },
    { id: 'volume2', title: 'Trading Volume 24-04-2023 (USD)' },
    { id: 'percentageChange', title: 'Price Change (%)' },
  ],
});

async function fetchHistoricalPrice(id: string, date: string): Promise<{ price: number; marketCap: number; volume: number } | null> {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${date}&localization=false`;

  try {
    const response = await axios.get(url);

    // Check if the necessary data exists in the response
    if (
      response.data &&
      response.data.market_data &&
      response.data.market_data.current_price &&
      typeof response.data.market_data.current_price.usd === 'number' &&
      response.data.market_data.market_cap &&
      typeof response.data.market_data.market_cap.usd === 'number' &&
      response.data.market_data.total_volume &&
      typeof response.data.market_data.total_volume.usd === 'number'
    ) {
      const price = response.data.market_data.current_price.usd;
      const marketCap = response.data.market_data.market_cap.usd;
      const volume = response.data.market_data.total_volume.usd;
      return { price, marketCap, volume };
    } else {
      return null;
    }
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log(`Rate limit hit. Pausing for 60 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetchHistoricalPrice(id, date);
    }

    console.error(`Failed to fetch historical price for ${id} on ${date}: `, error);
    return null;
  }
}

async function main(filename: string) {
  const writer = csvWriter(filename);
  const data = JSON.parse(fs.readFileSync(`assets/${filename}.json`, 'utf-8'));

  for (const [index, entry] of data.entries()) {
    const historicalData1 = await fetchHistoricalPrice(entry.id, '31-03-2022');
    const historicalData2 = await fetchHistoricalPrice(entry.id, '24-04-2023');

    if (historicalData1 !== null && historicalData2 !== null) {
      const percentageChange = ((historicalData2.price - historicalData1.price) / historicalData1.price) * 100;

      const coinData: CoinData = {
        id: entry.id,
        name: entry.name,
        symbol: entry.symbol,
        price1: historicalData1.price,
        price2: historicalData2.price,
        percentageChange,
        marketCap1: historicalData1.marketCap,
        volume1: historicalData1.volume,
        marketCap2: historicalData2.marketCap,
        volume2: historicalData2.volume,
      };

      await writer.writeRecords([coinData]);

      console.log(`Processed ${entry.name} (${entry.id}). Progress: ${index + 1}/${data.length}`);
    } else {
      console.log(`Skipped ${entry.name} (${entry.id}) due to missing data. Progress: ${index + 1}/${data.length}`);
    }

    await new Promise(resolve => setTimeout(resolve, 8500));
  }

  console.log(`Finished processing. CSV file complete.`);
}

main("all");
