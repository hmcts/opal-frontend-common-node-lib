class SessionStorageConfiguration {
  secret!: string;
  prefix!: string;
  maxAge!: number;
  sameSite!: boolean;
  secure!: boolean;
  domain!: string;
  redisEnabled!: boolean;
  redisConnectionString!: string;
}

export default SessionStorageConfiguration;
