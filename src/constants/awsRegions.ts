export interface AwsRegionOption {
  value: string;
  label: string;
  name: string;
}

export const AWS_REGIONS: AwsRegionOption[] = [
  // US East & West
  { value: 'us-east-1', label: 'us-east-1 (N. Virginia)', name: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'us-east-2 (Ohio)', name: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'us-west-1 (N. California)', name: 'US West (N. California)' },
  { value: 'us-west-2', label: 'us-west-2 (Oregon)', name: 'US West (Oregon)' },

  // Africa
  { value: 'af-south-1', label: 'af-south-1 (Cape Town)', name: 'Africa (Cape Town)' },

  // Asia Pacific
  { value: 'ap-east-1', label: 'ap-east-1 (Hong Kong)', name: 'Asia Pacific (Hong Kong)' },
  { value: 'ap-south-1', label: 'ap-south-1 (Mumbai)', name: 'Asia Pacific (Mumbai)' },
  { value: 'ap-south-2', label: 'ap-south-2 (Hyderabad)', name: 'Asia Pacific (Hyderabad)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)', name: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'ap-southeast-2 (Sydney)', name: 'Asia Pacific (Sydney)' },
  { value: 'ap-southeast-3', label: 'ap-southeast-3 (Jakarta)', name: 'Asia Pacific (Jakarta)' },
  { value: 'ap-southeast-4', label: 'ap-southeast-4 (Melbourne)', name: 'Asia Pacific (Melbourne)' },
  { value: 'ap-southeast-5', label: 'ap-southeast-5 (Malaysia)', name: 'Asia Pacific (Malaysia)' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1 (Tokyo)', name: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'ap-northeast-2 (Seoul)', name: 'Asia Pacific (Seoul)' },
  { value: 'ap-northeast-3', label: 'ap-northeast-3 (Osaka)', name: 'Asia Pacific (Osaka)' },

  // Canada
  { value: 'ca-central-1', label: 'ca-central-1 (Central)', name: 'Canada (Central)' },
  { value: 'ca-west-1', label: 'ca-west-1 (Calgary)', name: 'Canada West (Calgary)' },

  // Europe
  { value: 'eu-central-1', label: 'eu-central-1 (Frankfurt)', name: 'Europe (Frankfurt)' },
  { value: 'eu-central-2', label: 'eu-central-2 (Zurich)', name: 'Europe (Zurich)' },
  { value: 'eu-west-1', label: 'eu-west-1 (Ireland)', name: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'eu-west-2 (London)', name: 'Europe (London)' },
  { value: 'eu-west-3', label: 'eu-west-3 (Paris)', name: 'Europe (Paris)' },
  { value: 'eu-south-1', label: 'eu-south-1 (Milan)', name: 'Europe (Milan)' },
  { value: 'eu-south-2', label: 'eu-south-2 (Spain)', name: 'Europe (Spain)' },
  { value: 'eu-north-1', label: 'eu-north-1 (Stockholm)', name: 'Europe (Stockholm)' },

  // Israel & Middle East
  { value: 'il-central-1', label: 'il-central-1 (Tel Aviv)', name: 'Israel (Tel Aviv)' },
  { value: 'me-south-1', label: 'me-south-1 (Bahrain)', name: 'Middle East (Bahrain)' },
  { value: 'me-central-1', label: 'me-central-1 (UAE)', name: 'Middle East (UAE)' },

  // South America
  { value: 'sa-east-1', label: 'sa-east-1 (São Paulo)', name: 'South America (São Paulo)' },

  // AWS GovCloud
  { value: 'us-gov-east-1', label: 'us-gov-east-1 (GovCloud US East)', name: 'AWS GovCloud (US-East)' },
  { value: 'us-gov-west-1', label: 'us-gov-west-1 (GovCloud US West)', name: 'AWS GovCloud (US-West)' },

  // Mexico
  { value: 'mx-central-1', label: 'mx-central-1 (Central)', name: 'Mexico (Central)' },
];
