class OpalUserServiceConfiguration {
  userStateUrl!: string;
  addUserUrl!: string;
  updateUserUrl!: string;
  timeoutInMilliseconds!: number;
  retryAttempts!: number;
  retryDelayInMilliseconds!: number;
}

export default OpalUserServiceConfiguration;
