import { CurrencyAmount, Fraction, TokenAmount, Trade } from 'mahaswap-sdk'

import { useArthControllerContract, useTokenContract } from 'hooks/useContract'
import { useCallback, useEffect, useState } from 'react'
import { BigNumber } from 'ethers'
import { getDisplayBalance } from 'utils/formatBalance'
import { MAHA } from '../constants'
import { useActiveWeb3React } from 'hooks'

const decimals = BigNumber.from(10).pow(18)

const useMahaIncentives = (incentiveTokenSymbol: string, trade?: Trade | null) => {
  const { account, chainId } = useActiveWeb3React()

  const [mahaFee, setMahaFee] = useState('?')
  const [mahaReward, setMahaReward] = useState('?')

  const [side, setSide] = useState('selling')
  const [hasBalance, setHasBalance] = useState(true)

  const contract = useArthControllerContract()
  const mahaToken = useTokenContract(MAHA[chainId || 1].address)

  const action = useCallback(
    async (arthAmount: CurrencyAmount, arthReserve: TokenAmount, _startingPrice: Fraction, _endingPrice: Fraction) => {
      if (!contract) return

      const volume = decimals.mul(arthAmount.multiply('100000').toFixed(0)).div(100000)
      const endingPrice = decimals.mul(_endingPrice.multiply('100000').toFixed(0)).div(100000)
      const startingPrice = decimals.mul(_startingPrice.multiply('100000').toFixed(0)).div(100000)
      const liquidity = decimals.mul(arthReserve.multiply('100000').toFixed(0)).div(100000)

      const reward = await contract.estimateRewardToGive(startingPrice, liquidity, volume)
      const fee = await contract.estimatePenaltyToCharge(endingPrice, liquidity, volume)

      setMahaFee(getDisplayBalance(fee, 18, 4))
      setMahaReward(getDisplayBalance(reward, 18, 4))

      // MAHA.
      if (mahaToken && side === 'selling') {
        const bal = await mahaToken.balanceOf(account)
        setHasBalance(bal.gt(fee))
      } else setHasBalance(true)
    },
    [contract, mahaToken, account, side]
  )

  useEffect(() => {
    if (!trade) return

    const pair = trade.route.pairs[0]

    const _side = trade.inputAmount.currency.symbol === incentiveTokenSymbol ? 'selling' : 'buying'
    setSide(_side)

    const endingPrice =
      pair.token0.symbol === incentiveTokenSymbol && _side == 'buying'
        ? trade.nextMidPrice.invert()
        : trade.nextMidPrice

    const startingPrice =
      pair.token0.symbol === incentiveTokenSymbol && _side == 'buying'
        ? pair.reserve1.divide(pair.reserve0)
        : pair.reserve0.divide(pair.reserve1)

    const liquidity = pair.token0.symbol === incentiveTokenSymbol ? pair.reserve0 : pair.reserve1

    action(
      _side === 'selling' ? trade.inputAmount : trade.outputAmount,
      liquidity,
      startingPrice,
      endingPrice.raw
    ).catch(e => console.error(e.stack))
  }, [trade, incentiveTokenSymbol, action])

  return { mahaFee, mahaReward, side, hasBalance }
}

export default useMahaIncentives
