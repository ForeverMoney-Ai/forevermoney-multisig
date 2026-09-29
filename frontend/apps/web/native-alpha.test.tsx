import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { useFinneyAlphaAssets } from '@/components/common/FinneyAlphaAssets'
function FinneyAlphaAssets(){const a=useFinneyAlphaAssets(300);return <>{a.status}{a.rows.map(row=><div key={row.key}>{Object.entries(row.cells).map(([key,cell])=><div key={key}>{cell.content}</div>)}{row.expandedContent}</div>)}</>}
import { readAlphaPositions } from '@/services/tx/finney-alpha'

const safeAddress = '0x4816aF10706d7F1472837215fdD8f28CFa9A81ad'
const recipient = '5DXq7SMZQXQrsLhXfLZoRE8JYbzkNdfHrEruZQN4i7LvH6tK'
const hotkey = '0x06ee4f6ae37569097680a092d6307661481ffe9c92b7bfb5c4e8b94a9bed1d29'
const mockSetTxFlow = jest.fn()
const mockProvider = {}
jest.mock('@/components/tx-flow', () => ({ TxModalContext: require('react').createContext({setTxFlow: (...args:any[]) => mockSetTxFlow(...args)}) }))
jest.mock('@/components/common/FiatValue', () => ({__esModule:true, default: ({value}:any) => <span>{value == null ? '--' : String(value)}</span>}))
jest.mock('@/hooks/useChainId', () => ({__esModule:true, default: () => '964'}))
jest.mock('@/hooks/useSafeInfo', () => ({__esModule:true, default: () => ({safeAddress:'0x4816aF10706d7F1472837215fdD8f28CFa9A81ad',safeLoaded:true})}))
jest.mock('@/hooks/wallets/web3', () => ({useWeb3ReadOnly: () => mockProvider}))
jest.mock('@/components/common/CheckWallet', () => ({__esModule:true, default: ({children}:any) => children(true)}))
jest.mock('@/components/common/FinneyAlphaFlow', () => ({__esModule:true, default: () => null}))
jest.mock('@/services/tx/finney-alpha', () => ({...jest.requireActual('@/services/tx/finney-alpha'),readAlphaPositions:jest.fn()}))
beforeEach(() => {
  localStorage.clear()
  mockSetTxFlow.mockReset()
  ;(readAlphaPositions as jest.Mock).mockResolvedValue({positions:[{netuid:10,hotkey,amount:'418946583'}],prices:{10:'6000000000000000'},block:9169142})
  global.fetch = jest.fn().mockResolvedValue({ok:true,json:async()=>({subnets:[{netuid:10,name:'Pareton',logoUri:'/assets/metadata/subnets/sn10.webp'}]})})
})
afterEach(cleanup)
it('opens standard transaction flow with every validator position', async()=>{
 render(<FinneyAlphaAssets/>);await screen.findByRole('button',{name:'SN10 validators'});
 fireEvent.click(screen.getByRole('button',{name:'Send SN10'}));
 expect(mockSetTxFlow.mock.calls[0][0].props.positions).toEqual([{netuid:10,hotkey,amount:'418946583'}]);
 expect(mockSetTxFlow.mock.calls[0][0].props.safeAddress).toEqual(safeAddress);
 expect(screen.queryByLabelText('Recipient · Finney SS58')).not.toBeInTheDocument();
})
it('restores a saved balance immediately while refreshing and disables stale sending',async()=>{
 localStorage.setItem(`finney:964:native-stake:v2:${safeAddress.toLowerCase()}`,JSON.stringify({address:safeAddress,block:9169142,savedAt:Date.now(),positions:[{netuid:10,hotkey,amount:'418946583'}],prices:{10:'6000000000000000'}}));
 let reject:any;(readAlphaPositions as jest.Mock).mockReturnValue(new Promise((_,r)=>{reject=r}));
 render(<FinneyAlphaAssets/>);await screen.findByRole('button',{name:'SN10 validators'});
 expect(screen.getByRole('status')).toHaveTextContent('Updating saved');
 expect(screen.getByRole('button',{name:'Send SN10'})).toBeDisabled();
 reject(new Error('Unavailable'));await screen.findByRole('alert');
 expect(screen.getByTitle('0.418946583 SN10')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Send SN10'})).toBeDisabled();
})
it('collapses validators into one subnet row and expands both positions',async()=>{
  ;(readAlphaPositions as jest.Mock).mockResolvedValue({positions:[{netuid:10,hotkey,amount:'418946583'},{netuid:10,hotkey:'0x'+ '11'.repeat(32),amount:'200000000'}],prices:{10:'6000000000000000'},block:9169142})
  render(<FinneyAlphaAssets/>);await screen.findByRole('button',{name:'SN10 validators'})
  expect(screen.getByRole('button',{name:'SN10 validators'})).toHaveAttribute('aria-expanded','false')
  expect(screen.queryByText('Validator hotkey')).not.toBeInTheDocument()
  expect(screen.getByTitle('0.618946583 SN10')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'SN10 validators'}))
  expect(screen.getAllByText('Validator hotkey')).toHaveLength(2)
  expect(screen.getAllByRole('button',{name:'Send from validator'})).toHaveLength(2)
})

it('ignores expired, malformed and another multisig cache',()=>{
 const {readCachedAlpha}=require('@/components/common/FinneyAlphaAssets');
 const key=`finney:964:native-stake:v2:${safeAddress.toLowerCase()}`;
 const valid={address:safeAddress,block:9169142,savedAt:Date.now(),positions:[{netuid:10,hotkey,amount:'418946583'}],prices:{10:'6000000000000000'}};
 for(const patch of [{savedAt:Date.now()-86400001},{savedAt:null},{address:'0x'+'11'.repeat(20)},{positions:[{netuid:10,hotkey,amount:'NaN'}]}]){localStorage.setItem(key,JSON.stringify({...valid,...patch}));expect(readCachedAlpha(safeAddress)).toBeUndefined()}
})
