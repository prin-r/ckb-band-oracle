const { getCells, updateOracleLiveCells } = require('./rpc')
const { parseBandData } = require('./utils')
const { fetchSymbols, fetchBandOracle } = require('./band')

;(async () => {
  while (true) {
    try {
      console.log('--------------------- getCells')
      const liveCells = await getCells()
      console.log(`Got ${liveCells.length} cells`)
      if (liveCells.length === 0) {
        continue
      }

      console.log('--------------------- fetchBandOracle')
      const symbols = await fetchSymbols()
      const { pricesWithTimestamps } = await fetchBandOracle(symbols)
      console.log(`Got ${pricesWithTimestamps.length} pricesWithTimestamps`)
      // const m = {}
      // for ({ output_data } of liveCells) {
      //   try {
      //     const { index, timestamp, price } = parseBandData(output_data)
      //     if (symbols[index]) {
      //       m[symbols[index]] = { timestamp, price }
      //     }
      //   } catch (e) {}
      // }
      // console.log('liveCells: ', JSON.stringify(m))

      console.info('--------------------- update oracle cells data')
      await updateOracleLiveCells(liveCells, pricesWithTimestamps)

      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        process.stdout.clearLine()
        process.stdout.cursorTo(0)
        process.stdout.write(`wait ${i} secs`)
      }
      console.log('\n---------------------------------------------------------------')
    } catch (e) {
      console.log(e)
    }
  }
})()
