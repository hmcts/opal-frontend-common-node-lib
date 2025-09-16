import UserState from './user-state';

class SecurityToken {
  user_state: UserState | undefined;
  access_token!: string;
}

export default SecurityToken;
