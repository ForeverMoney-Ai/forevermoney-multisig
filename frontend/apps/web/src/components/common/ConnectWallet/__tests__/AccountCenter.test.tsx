import { render } from '@/tests/test-utils'
import AccountCenter from '@/components/common/ConnectWallet/AccountCenter'
import { type EIP1193Provider } from '@web3-onboard/core'
import { act, waitFor, fireEvent } from '@testing-library/react'

const mockWallet = {
  address: '0x1234567890123456789012345678901234567890',
  chainId: '5',
  label: '',
  provider: null as unknown as EIP1193Provider,
}

// TODO: This test is flaky and randomly fails sometimes
describe('AccountCenter', () => {
  it('should open and close the account center on click', async () => {
    const { getByText, getByTestId } = render(<AccountCenter wallet={mockWallet} />)

    const openButton = getByTestId('open-account-center')

    act(() => {
      openButton.click()
    })

    const disconnectButton = getByText('Disconnect')

    expect(disconnectButton).toBeInTheDocument()

    act(() => {
      disconnectButton.click()
    })

    await waitFor(
      () => {
        expect(disconnectButton).not.toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })
})

it('copies both Finney address formats without opening wallet details', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const { getByRole, queryByText } = render(<AccountCenter wallet={{ ...mockWallet, chainId: '964' }} />)
  fireEvent.click(getByRole('button', { name: 'Copy TAO EVM address' }))
  expect(writeText).toHaveBeenLastCalledWith(mockWallet.address)
  fireEvent.click(getByRole('button', { name: 'Copy SS58 address' }))
  expect(writeText.mock.calls[1][0]).toMatch(/^5[1-9A-HJ-NP-Za-km-z]{47}$/)
  expect(queryByText('Disconnect')).not.toBeInTheDocument()
  fireEvent.click(getByRole('button', { name: 'Open wallet details' }))
  await waitFor(() => expect(queryByText('Disconnect')).toBeInTheDocument())
})
