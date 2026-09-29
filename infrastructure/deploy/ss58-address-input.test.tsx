import { fireEvent, waitFor } from '@testing-library/react'
import { render } from '@/tests/test-utils'
import { FormProvider, useForm } from 'react-hook-form'
import AddressInput from '@/components/common/AddressInput'
import { validateSs58Recipient } from '@/services/tx/finney-tao'
import { chainBuilder } from '@/tests/builders/chains'

const mockChain = chainBuilder().with({chainId:'964',shortName:'finney',features:[]}).build()
jest.mock('@/hooks/useChains',()=>({useCurrentChain:()=>mockChain,useChain:()=>mockChain,useHasFeature:()=>false}))
jest.mock('@/hooks/useAddressBook',()=>({__esModule:true,default:()=>({})}))
jest.mock('@/components/common/AddressInput/useNameResolver',()=>({__esModule:true,default:()=>({}),getEnsNotAvailableError:()=> 'Unavailable'}))
const address='5DXq7SMZQXQrsLhXfLZoRE8JYbzkNdfHrEruZQN4i7LvH6tK'
const zero='0x0000000000000000000000000000000000000000'
function Form({submit,allow=true,token=zero}:{submit:(value:unknown)=>void;allow?:boolean;token?:string}) {
 const methods=useForm({defaultValues:{recipient:''},mode:'onChange'})
 return <FormProvider {...methods}><form onSubmit={methods.handleSubmit(submit)}><AddressInput name="recipient" label="Recipient" allowFinneySs58={allow} validate={value=>value.startsWith('5')?validateSs58Recipient(value,token):undefined}/><button type="submit">Submit</button></form></FormProvider>
}
test.each([address,'finney:'+address])('accepts TAO SS58 and preserves account: %s', async value=>{
 const submit=jest.fn();const view=render(<Form submit={submit}/>);
 fireEvent.change(view.getByRole('textbox'),{target:{value}});fireEvent.click(view.getByText('Submit'));
 await waitFor(()=>expect(submit).toHaveBeenCalled());expect(submit.mock.calls[0][0]).toEqual({recipient:address})
})
test.each([{value:address.slice(0,-1)+'J',allow:true,token:zero,error:'checksum'}, {value:address,allow:false,token:zero,error:'Invalid address'}, {value:address,allow:true,token:'0x1111111111111111111111111111111111111111',error:'native TAO'}])('blocks invalid or unsupported SS58: $error',async ({value,allow,token,error})=>{
 const submit=jest.fn();const view=render(<Form submit={submit} allow={allow} token={token}/>);
 fireEvent.change(view.getByRole('textbox'),{target:{value}});fireEvent.click(view.getByText('Submit'));
 await waitFor(()=>expect(view.getByText(new RegExp(error))).toBeInTheDocument(),{timeout:3000});expect(submit).not.toHaveBeenCalled()
})
test('retains EVM recipient support',async()=>{
 const submit=jest.fn();const view=render(<Form submit={submit}/>);const value='0x814cfC546b8667efeACb3910C149aD3053708f8E';
 fireEvent.change(view.getByRole('textbox'),{target:{value}});fireEvent.click(view.getByText('Submit'));
 await waitFor(()=>expect(submit).toHaveBeenCalled());expect(submit.mock.calls[0][0].recipient).toBe(value)
})
