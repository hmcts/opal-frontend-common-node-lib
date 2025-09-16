class Permission {
  permission_id!: number;
  permission_name!: string;
}

class BusinessUnitUser {
  business_unit_user_id!: string;
  business_unit_id!: number;
  permissions!: Permission[];
}

class UserState {
  user_id!: number;
  username!: string;
  name!: string;
  status!: string | null;
  version!: number | null;
  business_unit_users!: BusinessUnitUser[];
}

export default UserState;
