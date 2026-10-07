const { ViewModel, SharedStateManager } = Liteframe;
import { getApiAsset } from '../../../../electron/config/apiConfig.js';
import { navigationVM } from '../../navigation/NavigationVM.js';

const TIMEOUT = 1000;


export default class UsersProfileVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) {
    super(stateManager);
    this.initializeState();
    this.getUserProfile();
  }


  initializeState() {
    this.setState('loading', false);
    this.setState('error', null);
    this.setState('success', null);

    this.setState('my-details', {});
    this.setState('profileTab', 'general');

    this.setState('user', {})
    this.setState('general-form', {})
    this.setState('security-form', {})
    this.setState('avatar-preview', null);
    this.setState('user-roles', []);
    this.setState('user-rules', []);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  updateAvatarPreview(path) {
    if (path === '') return;
    this.updateState('avatar-preview', getApiAsset(path));
  }

  updateSecurityForm(key, value) {
    const form = this.getState('security-form');

    this.updateState('security-form', {
      ...form,
      [key]: value,
    })
  }

  async getUserProfile() {
    if(this.getState('loading')) return;
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);


    try {
      const result = await window.ipcRenderer.invoke('users:get-profile');

      if ( result.success ) {
        const user = result.user;
        this.updateState('user', result.user);
        this.updateState('general-form', {display_name: user.display_name, phone: user.phone, email: user.email})
        this.updateState('user-roles', result.roles || []);
        this.updateState('user-rules', result.rules || []);
        this.updateAvatarPreview(result.user.avatar_url)
        this.updateState('success', {message: 'Successfully loaded user profile.'})
        return result.user;
      }

      throw new Error('Failed to fetch user profile.')
    } catch (error) {
      console.error('Error: fetching user profile ', error);
      this.updateState('error', error);
    } finally {
      this.updateState('loading', false);
    }
  }

  async updateAvatar(file) {
    if(this.getState('loading')) return 
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    const user = this.getState('user');

    if (!file) {
      this.updateState('error', {message: 'No file selected'});
      this.updateState('loading', false);
      return;
    }

    if (!user || !user.id) {
      this.updateState('error', {message: 'No user selected'});
      this.updateState('loading', false);
      return;
    }

    try {
      // Convert File to ArrayBuffer for IPC transfer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));

      const payload = {
        buffer: buffer,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        userId: user.id // Pass the target user ID
      };

      const result = await window.ipcRenderer.invoke('users:update-avatar', payload);



      if (!result.success) {
        throw new Error(result.error || 'Failed to update avatar');
      }

      this.updateState('success', {message: 'User avatar updated successfully.'})

    } catch (error) {
      console.error('Error updating avatar:', error);
      this.updateState('error', { message: error.message || 'Failed to update avatar' });
    } finally {
      await this.sleep(TIMEOUT)
      this.updateState('loading', false);
    }
  }

  updateGeneralForm(key, value) {
    const form = this.getState('general-form');
    this.updateState('general-form', {
      ...form,
      [key]: value
    })
  };

  async updateUserProfile() {
    if(this.getState('loading')) return;

    this.updateState('loading', true);
    this.updateState('success', null);
    this.updateState('error', null);

    const userData = this.getState('general-form');

    try {
      const response = await window.ipcRenderer.invoke('users:update-profile', userData);

      if(response.success) {
        this.updateState('user', response.user);
        this.updateState('success', {message: 'User profile updated successfully.'})
        return
      }

      throw new Error('Failed to update user profile.')
    } catch (error) {
      console.error('Error: updating user profile.', error);
      this.updateState('error', {message: error.message || 'Failed to update user profile.'})
    } finally {
      this.updateState('loading', false)
    }
  }

  async removeAvatar() {
    if(this.getState('loading')) return

    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    const userId = this.getState('user').id

    try {
      const response = await window.ipcRenderer.invoke('users:remove-avatar', userId);

      if(response.success) {
        this.updateState('user', response.user);
        this.updateState('avatar-preview', null);
        this.updateState('success', {message: 'User image removed successfully'})
        return 
      }
      throw new Error('Failed to remove user image.')
    } catch (error) {
      console.error('Error: removing user image', error);
      this.updateState('error', {message: 'Failed to remove user image.'})
    } finally {
      this.updateState('loading', false)
    }
  }

  async changePassword() {
    if(this.getState('loading')) return

    this.updateState('loading', true);
    this.updateState('success', null);
    this.updateState('error', null);

    const { currentPassword, newPassword, confirmPassword} = this.getState('security-form');

    if(!currentPassword && !newPassword && !confirmPassword) {
      
      this.updateState('error', {message: 'Missing required field.'});
      this.updateState('loading', false);
      return
    }

    if(newPassword !== confirmPassword) {
      
      this.updateState('error', { message: 'Passwords do not match.' });
      this.updateState('loading', false);
      return
    }

    try {
      const result = await window.ipcRenderer.invoke('users:change-password', {currentPassword, newPassword, confirmPassword});
      if(result.success) {
        this.updateState('success', { message: result.message || 'Password updated successfully.' });
        return;
      } 

      throw new Error(result.error || 'Password updating failed.')
    } catch (error) {
      console.error('Error: updating password', error);
      this.updateState('error', {message: error.message || 'Failed to update password'})
    } finally {
      this.updateState('loading', false);
    }


  }


  

}