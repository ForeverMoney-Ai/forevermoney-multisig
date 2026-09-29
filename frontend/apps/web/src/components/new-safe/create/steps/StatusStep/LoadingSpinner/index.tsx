export enum SpinnerStatus { ERROR='isError', SUCCESS='isSuccess', PROCESSING='isProcessing' }
const LoadingSpinner=({status}:{status:SpinnerStatus})=><div role="status" aria-label={status===SpinnerStatus.SUCCESS?'Account ready':status===SpinnerStatus.ERROR?'Creation failed':'Creating account'} className="flex h-32 items-center justify-center"><img src="/images/forevermoney/icon-black.svg" alt="" width={96} height={80} className="dark:hidden"/><img src="/images/forevermoney/icon-white.svg" alt="" width={96} height={80} className="hidden dark:block"/></div>
export default LoadingSpinner
