import { MigrateSafeL2Review } from './MigrateSafeL2Review'
import SettingsIcon from '@/public/images/sidebar/settings.svg'
import { TxFlow } from '../../TxFlow'

const MigrateSafeL2Flow = () => (
  <TxFlow
    icon={SettingsIcon}
    subtitle="Update Multi-sig account base contract"
    ReviewTransactionComponent={MigrateSafeL2Review}
  />
)

export default MigrateSafeL2Flow
