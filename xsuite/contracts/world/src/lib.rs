#![no_std]

multiversx_sc::imports!();

#[multiversx_sc::contract]
pub trait World {
    #[init]
    fn init(&self, n: u64) {
        self.n().set(n);
    }

    #[upgrade]
    fn upgrade(&self, n: u64) {
        self.init(n);
    }

    #[payable("*")]
    #[endpoint]
    fn fund(&self) {}

    #[endpoint]
    fn require_positive(&self, amount: u64) {
        require!(amount > 0, "Amount is not positive.");
    }

    #[payable("EGLD")]
    #[endpoint]
    fn get_value(&self) -> BigUint {
        self.call_value().egld_value().clone_value()
    }

    #[endpoint]
    fn get_caller(&self) -> ManagedAddress {
        self.blockchain().get_caller()
    }

    #[endpoint]
    fn get_current_block_info(&self) -> MultiValueEncoded<u64> {
        let mut current_block_info = MultiValueEncoded::new();
        current_block_info.push(self.blockchain().get_block_epoch());
        current_block_info.push(self.blockchain().get_block_nonce());
        current_block_info.push(self.blockchain().get_block_round());
        current_block_info.push(self.blockchain().get_block_timestamp());
        current_block_info
    }

    #[endpoint]
    fn get_prev_block_info(&self) -> MultiValueEncoded<u64> {
        let mut previous_block_info = MultiValueEncoded::new();
        previous_block_info.push(self.blockchain().get_prev_block_epoch());
        previous_block_info.push(self.blockchain().get_prev_block_nonce());
        previous_block_info.push(self.blockchain().get_prev_block_round());
        previous_block_info.push(self.blockchain().get_prev_block_timestamp());
        previous_block_info
    }

    #[endpoint]
    fn multiply_by_n(&self, x: u64) -> u64 {
        x * self.n().get()
    }

    #[endpoint]
    fn set_n(&self, n: u64) {
        self.n().set(n);
    }

    #[endpoint]
    fn get_back_transfers(&self) -> (BigUint, MultiEsdtPayment<Self::Api>) {
        let BackTransfers { total_egld_amount, esdt_payments } = self.blockchain().get_back_transfers();
        (total_egld_amount, esdt_payments)
    }

    #[payable("EGLD")]
    #[endpoint]
    fn issue_token_without_callback_v2(&self) {
        self.issue_fungible_v2(None);
    }

    #[payable("EGLD")]
    #[endpoint]
    fn issue_token_with_succeeding_callback_v2(&self) {
        self.issue_fungible_v2(Some(self.callbacks().succeeding_callback_v2()));
    }

    #[payable("EGLD")]
    #[endpoint]
    fn issue_token_with_failing_callback_v2(&self) {
        self.issue_fungible_v2(Some(self.callbacks().failing_callback_v2()));
    }

    #[payable("EGLD")]
    #[endpoint]
    fn issue_tokens_with_return_and_succeeding_callback_v2(&self) -> ManagedBuffer {
        self.issue_fungible_v2(Some(self.callbacks().succeeding_callback_v2()));
        self.issue_fungible_v2(Some(self.callbacks().succeeding_callback_v2()));
        ManagedBuffer::new_from_bytes(b"call")
    }

    #[payable("EGLD")]
    #[endpoint]
    fn issue_token_without_callback_v1(&self) {
        self.issue_fungible_v1(None);
    }

    #[payable("EGLD")]
    #[endpoint]
    fn issue_token_with_succeeding_callback_v1(&self) {
        self.issue_fungible_v1(Some(self.callbacks().succeeding_callback_v1()));
    }

    #[payable("EGLD")]
    #[endpoint]
    fn issue_token_with_failing_callback_v1(&self) {
        self.issue_fungible_v1(Some(self.callbacks().failing_callback_v1()));
    }

    fn issue_fungible_v2(&self, opt_callback_closure: Option<CallbackClosure<Self::Api>>) {
        let x = self.issue_fungible().gas(50_000_000);
        if let Some(callback_closure) = opt_callback_closure {
            x.callback(callback_closure).register_promise();
        } else {
            x.register_promise();
        }
    }

    fn issue_fungible_v1(&self, opt_callback_closure: Option<CallbackClosure<Self::Api>>) {
        let x = self.issue_fungible();
        if let Some(callback_closure) = opt_callback_closure {
            x.with_callback(callback_closure).async_call_and_exit();
        } else {
            x.async_call_and_exit();
        }
    }

    fn issue_fungible(&self) -> IssueCall<TxScEnv<Self::Api>, (), ESDTSystemSCAddress, ()> {
        self.send()
            .esdt_system_sc_proxy()
            .issue_fungible(
                self.call_value().egld_value().clone_value(),
                &ManagedBuffer::new_from_bytes(b"TEST"),
                &ManagedBuffer::new_from_bytes(b"TEST"),
                &BigUint::from(1u32),
                FungibleTokenProperties::default(),
            )
    }

    #[promises_callback]
    fn succeeding_callback_v2(&self) -> (TokenIdentifier, BigUint) {
        self.call_value().single_fungible_esdt()
    }

    #[callback]
    fn succeeding_callback_v1(&self) -> (TokenIdentifier, BigUint) {
        self.call_value().single_fungible_esdt()
    }

    #[promises_callback]
    fn failing_callback_v2(&self) {
        require!(false, "Fail");
    }

    #[callback]
    fn failing_callback_v1(&self) {
        require!(false, "Fail");
    }

    #[storage_mapper("n")]
    fn n(&self) -> SingleValueMapper<u64>;

    #[storage_mapper("token")]
    fn token(&self) -> FungibleTokenMapper;
}
