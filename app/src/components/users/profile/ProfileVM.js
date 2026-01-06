const { ViewModel, SharedStateManager } = Liteframe;
import { getApiAsset } from '../../../../electron/config/apiConfig.js';
import { navigationVM } from '../../navigation/NavigationVM.js';


export default class UsersProfileVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) {
    super(stateManager);
    this.initializeState();
  }


  initializeState() {
    this.setState('loading', false);
    this.setState('error', null);
    this.setState('success', null);

    this.setState('my-details', {});
    this.setState('profileTab', 'general');

    this.setState('user', {
      username: 'mebratu',
      full_name: 'Mebratu Fenta Wakeni',
      employee_id: null,
      status: 'Active',
      created_at: new Date(),
      display_name: 'Mebratu Fenta Wakeni',
      phone: '0978448272',
      timezone: 'East African',
      language: 'Amharic'
    })
    this.setState('generalForm', {})
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}