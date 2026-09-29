import React from 'react'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {CreateAlphaTransfer} from '@/components/common/FinneyAlphaFlow'
const mockNext=jest.fn()
jest.mock('@/components/tx-flow/TxFlowProvider',()=>({TxFlowContext:require('react').createContext({onNext:(...args:any[])=>mockNext(...args)})}))
jest.mock('@/components/tx-flow/TxFlow',()=>({TxFlow:()=>null}))
jest.mock('@/components/tx-flow/TxFlowStep',()=>({TxFlowStep:()=>null}))
jest.mock('@/components/tx-flow/SafeTxProvider',()=>({SafeTxContext:require('react').createContext({})}))
jest.mock('@/components/tx/ReviewTransactionV2',()=>({__esModule:true,default:()=>null}))
jest.mock('@/services/tx/tx-sender',()=>({createMultiSendCallOnlyTx:jest.fn()}))
jest.mock('@/hooks/useSafeInfo',()=>({__esModule:true,default:()=>({})}))
jest.mock('@/hooks/useChainId',()=>({__esModule:true,default:()=> '964'}))
jest.mock('@/hooks/wallets/web3',()=>({useWeb3ReadOnly:()=>null}))
jest.mock('@/components/common/CheckWallet',()=>({__esModule:true,default:({children}:any)=>children(true)}))
const safeAddress='0x4816aF10706d7F1472837215fdD8f28CFa9A81ad'
const recipient='5DXq7SMZQXQrsLhXfLZoRE8JYbzkNdfHrEruZQN4i7LvH6tK'
const positions=[{netuid:10,hotkey:'0x'+'11'.repeat(32),amount:'418946583'},{netuid:10,hotkey:'0x'+'22'.repeat(32),amount:'200000000'}]
beforeEach(()=>mockNext.mockReset());afterEach(cleanup)
it('defaults to combined balance, previews the split, and supports manual selection',()=>{
 render(<CreateAlphaTransfer positions={positions} safeAddress={safeAddress}/>);
 fireEvent.click(screen.getByRole('button',{name:'Max'}));expect(screen.getByLabelText('Amount · SN10')).toHaveValue('0.618946583');
 fireEvent.change(screen.getByLabelText('Recipient · TAO EVM or SS58'),{target:{value:recipient}});
 fireEvent.change(screen.getByLabelText('Amount · SN10'),{target:{value:'0.5'}});
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(mockNext.mock.calls[0][0].plan.map((p:any)=>p.amount)).toEqual(['418946583','81053417']);
 expect(mockNext.mock.calls[0][0].amount).toEqual('0.5');
 fireEvent.change(screen.getByLabelText('Validator selection · Automatic'),{target:{value:positions[1].hotkey}});
 expect(screen.getByLabelText('Amount · SN10')).toHaveValue('');
 fireEvent.click(screen.getByRole('button',{name:'Max'}));expect(screen.getByLabelText('Amount · SN10')).toHaveValue('0.2');
 fireEvent.click(screen.getByRole('button',{name:'Next'}));expect(mockNext.mock.calls[1][0].plan).toEqual([positions[1]]);
})
it('rejects excess, malformed and self recipients',()=>{
 render(<CreateAlphaTransfer positions={positions} initialHotkey={positions[0].hotkey} safeAddress={safeAddress}/>);
 fireEvent.change(screen.getByLabelText('Amount · SN10'),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'Next'}));expect(screen.getByRole('alert')).toHaveTextContent('exceeds');
 fireEvent.change(screen.getByLabelText('Amount · SN10'),{target:{value:'0.1'}});
 for(const recipient of ['bad',safeAddress,'finney:'+safeAddress,'5HCiqveWdMteyv3jkPKAsuxm8wGokKSimNhwK7sY73JDPRnv']){fireEvent.change(screen.getByLabelText('Recipient · TAO EVM or SS58'),{target:{value:recipient}});fireEvent.click(screen.getByRole('button',{name:'Next'}));}
 expect(mockNext).not.toHaveBeenCalled();
})

it('accepts TAO EVM recipients and displays the resolved native destination',()=>{
 render(<CreateAlphaTransfer positions={positions} safeAddress={safeAddress}/>);
 fireEvent.change(screen.getByLabelText('Amount · SN10'),{target:{value:'0.1'}});
 for(const value of ['0x814cfC546b8667efeACb3910C149aD3053708f8E','finney:0x814cfC546b8667efeACb3910C149aD3053708f8E']) {
  fireEvent.change(screen.getByLabelText('Recipient · TAO EVM or SS58'),{target:{value}});
  expect(screen.getByText(recipient)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(mockNext.mock.calls.at(-1)[0].recipient).toEqual(value);
 }
 expect(mockNext).toHaveBeenCalledTimes(2);
})
