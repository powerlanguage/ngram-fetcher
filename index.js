import fetch from "cross-fetch";
import fs from "fs/promises";

const ENGLISH_2019_CORPUS = 26;
const SMOOTHING = 10;
const START_YEAR = 1980;
const END_YEAR = 2019;
const BASE_URL = `https://books.google.com/ngrams/json?`;
const RETRY_DELAY_MS = 5000;

function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const MAX_RETRIES = 3;

async function fetchNgrams(words, retries = MAX_RETRIES) {
  const params = new URLSearchParams();
  params.set("content", words.join(","));
  params.set("year_start", START_YEAR);
  params.set("year_end", END_YEAR);
  params.set("corpus", ENGLISH_2019_CORPUS);
  params.set("smoothing", SMOOTHING);

  const url = `${BASE_URL}${params}`;

  console.log(url);
  const res = await fetch(url);

  try {
    const data = await res.json();
    return data;
  } catch (err) {
    const retry = retries - 1;
    if (retry < 0) {
      console.log(`Fetch failed.`);
      console.log(err);
      console.log(res);
      return;
    }
    console.log(
      `Fetch failed, retrying in ${RETRY_DELAY_MS} ms, ${
        MAX_RETRIES - retry
      } of ${MAX_RETRIES}...`
    );
    await delay(5000);
    await fetchNgrams(words, retry);
  }
}
// How many ngrams we fetch at once
const CHUNK_SIZE = 20;

function massageData(ngramsData) {
  return ngramsData.map((ngramData) => {
    const { ngram, timeseries } = ngramData;
    const tsTotal = timeseries.reduce((acc, item) => acc + item, 0);
    const average = tsTotal / timeseries.length;
    return { ngram, average };
  });
}

function convertDataToCSVString(massagedData) {
  return massagedData.reduce((acc, item) => {
    const row = `${item.ngram},${item.average}\n`;
    return acc + row;
  }, "");
}

async function writeToFile(content) {
  await fs.writeFile("results.csv", content, { flag: "a" }, (err) => {});
}

async function run(wordArray) {
  if (!wordArray || wordArray.length === 0) {
    console.log("Invalid word array, exiting");
    return;
  }
  let j = 0;
  for (let i = j * CHUNK_SIZE; i < wordArray.length; i += CHUNK_SIZE) {
    const start = i;
    const end = start + CHUNK_SIZE;
    const chunk = wordArray.slice(start, end);
    console.log(`Fetching chunk ${j}: ${start} - ${end}...`);
    const ngramsData = await fetchNgrams(chunk);
    console.log("Fetch complete");
    console.log("Massaging data...");
    const massagedData = massageData(ngramsData);
    const writableString = convertDataToCSVString(massagedData);
    console.log("Writing to file...");
    await writeToFile(writableString);
    console.log("Done.");
    j++;
  }
}

// Input your word array here..
run();
