import { CurrencyAmount, Fraction, TokenAmount, Trade } from 'mahaswap-sdk'

import { useArthControllerContract } from 'hooks/useContract'
import { useCallback, useEffect, useState } from 'react'
import { BigNumber } from 'ethers'
import { getDisplayBalance } from 'utils/formatBalance'

const decimals = BigNumber.from(10).pow(18)

const useMahaIncentives = (incentiveTokenSymbol: string, trade?: Trade | null) => {
  // const pair = trade?.route.pairs[0]
  const [mahaFee, setMahaFee] = useState('0')
  const [side, setSide] = useState('selling')

  const [mahaReward, setMahaReward] = useState('0')

  const contract = useArthControllerContract()

  const action = useCallback(
    async (arthAmount: CurrencyAmount, arthReserve: TokenAmount, _price: Fraction) => {
      if (!contract) return

      const volume = decimals.mul(arthAmount.multiply('1000').toFixed(0)).div(1000)
      const price = decimals.mul(_price.multiply('1000').toFixed(0)).div(1000)
      const liquidity = decimals.mul(arthReserve.multiply('1000').toFixed(0)).div(1000)

      const reward = await contract.estimateRewardToGive(volume)
      const fee = await contract.estimatePenaltyToCharge(price, liquidity, volume)

      setMahaFee(getDisplayBalance(fee, 18, 4))
      setMahaReward(getDisplayBalance(reward, 18, 4))
    },
    [contract]
  )

  useEffect(() => {
    if (!trade) return

    const pair = trade.route.pairs[0]

    const price =
      pair.token0.symbol === incentiveTokenSymbol
        ? pair.reserve1.divide(pair.reserve0)
        : pair.reserve0.divide(pair.reserve1)

    const liquidity = pair.token0.symbol === incentiveTokenSymbol ? pair.reserve0 : pair.reserve1

    const _side = trade.inputAmount.currency.symbol === incentiveTokenSymbol ? 'selling' : 'buying'

    setSide(_side)

    action(_side === 'selling' ? trade.inputAmount : trade.outputAmount, liquidity, price).catch(err =>
      console.error(err.stack)
    )
  }, [trade, incentiveTokenSymbol, action])

  return { mahaFee, mahaReward, side }
}

export default useMahaIncentives
