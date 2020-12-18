const CKB = require('@nervosnetwork/ckb-sdk-core').default
const fetch = require('node-fetch')
const BN = require('bn.js')
const { CKB_INDEXER_URL, CKB_NODE_URL, PRI_KEY, BAND_SYMBOL } = require('./const')
const { remove0x, generateBandData, parseBandData } = require('./utils')

const ckb = new CKB(CKB_NODE_URL)
const PUB_KEY = ckb.utils.privateKeyToPublicKey(PRI_KEY)
const ARGS = '0x' + ckb.utils.blake160(PUB_KEY, 'hex')
const FEE = new BN(37_000)

const secp256k1LockScript = async () => {
  const secp256k1Dep = (await ckb.loadDeps()).secp256k1Dep
  return {
    codeHash: secp256k1Dep.codeHash,
    hashType: secp256k1Dep.hashType,
    args: ARGS,
  }
}

const generateInput = cell => {
  return {
    previousOutput: {
      txHash: cell.out_point.tx_hash,
      index: cell.out_point.index,
    },
    since: '0x0',
  }
}

const getCells = async () => {
  let lock = null
  try {
    lock = await secp256k1LockScript(ARGS)
  } catch (error) {
    console.error('error', error)
    return []
  }
  let payload = {
    id: 1,
    jsonrpc: '2.0',
    method: 'get_cells',
    params: [
      {
        script: {
          code_hash: lock.codeHash,
          hash_type: lock.hashType,
          args: lock.args,
        },
        script_type: 'lock',
      },
      'asc',
      '0x3e8',
    ],
  }
  const body = JSON.stringify(payload, null, '  ')
  try {
    let res = await fetch(CKB_INDEXER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    })
    res = await res.json()
    return res.result.objects
  } catch (error) {
    console.error('error', error)
  }
}

const updateOracleLiveCells = async (liveCells, pricesWithTimestamps) => {
  const secp256k1Dep = (await ckb.loadDeps()).secp256k1Dep
  const lock = await secp256k1LockScript()
  const pricesData = pricesWithTimestamps.map(({ price, timestamp }, index) => generateBandData(price, index, timestamp))
  let rawTx = {
    version: '0x0',
    cellDeps: [{ outPoint: secp256k1Dep.outPoint, depType: 'depGroup' }],
    headerDeps: [],
  }
  let inputs = []
  let outputs = []
  let outputsData = []
  const bandLiveCells = liveCells.filter(cell => remove0x(cell.output_data).startsWith(BAND_SYMBOL))
  bandLiveCells.forEach((cell, cellIndex) => {
    const { index } = parseBandData(cell.output_data)
    inputs.push(generateInput(cell))
    outputs.push({
      capacity:
        cellIndex === bandLiveCells.length - 1
          ? `0x${new BN(remove0x(cell.output.capacity), 'hex').sub(FEE).toString(16)}`
          : cell.output.capacity,
      lock,
      type: null,
    })
    outputsData.push(pricesData[index])
  })
  rawTx = {
    ...rawTx,
    inputs,
    outputs,
    outputsData,
    witnesses: inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' })),
  }
  try {
    const signedTx = ckb.signTransaction(PRI_KEY)(rawTx)
    const txHash = await ckb.rpc.sendTransaction(signedTx)
    console.info(`Update oracle cells data tx: ${txHash}`)
  } catch (error) {
    console.error(error)
  }
}

module.exports = {
  getCells,
  updateOracleLiveCells,
}
