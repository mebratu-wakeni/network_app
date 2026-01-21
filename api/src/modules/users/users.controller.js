/**
 * Controller: HTTP layer for users
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
export class UsersController {
  constructor(service) {
    this.service = service
  }

  /**
   * GET /api/users/me
   * Get current authenticated user with permissions
   */
  getCurrentUser = async (req, res, next) => {
    try {
      if (!req.user) {
        const error = new Error('Authentication required')
        error.status = 401
        return next(error)
      }

      // Return current user with their rules
      res.json({
        ok: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          display_name: req.user.display_name,
          is_active: req.user.is_active,
          rules: req.user.rules || []
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/users/:id
   * Get user profile (excluding password)
   */
  getProfile = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const user = await this.service.getById(id)
      res.json({ ok: true, user })
    } catch (error) {
      next(error)
    }
  }


  /**
   * POST /api/users/:id/roles
   * Assign role to user (admin only)
   */
  assignRole = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const result = await this.service.assignRoleToUser(id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  // controllers/users.controller.js
  deleteUser = async (req, res, next) => {
    try {
      const { id } = req.validParams;
      const loggedInUserId = Number(req.user.id);

      if (id === loggedInUserId) {
        const error = new Error('You cannot delete your own account');
        error.status = 403;
        return next(error);
      }

      const deletedUser = await this.service.deleteUser(id);

      return res.json({
        ok: true,
        data: deletedUser,
      });
    } catch (error) {
      next(error);
    }
  };


  /**
   * DELETE /api/users/:id/roles
   * Remove role from user (admin only)
   */
  removeRole = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const result = await this.service.removeRoleFromUser(id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/users/:id/rules
   * Assign rule to user (admin only)
   */
  assignRule = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const result = await this.service.assignRuleToUser(id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/users/:id/rules
   * Remove rule from user (admin only)
   */
  removeRule = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const result = await this.service.removeRuleFromUser(id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  getUsersList = async (req, res, next) => {
    try {
      const { searchQuery = '', tableConfig = {} } = req.validBody || {}
      const result = await this.service.getUsersList(searchQuery, tableConfig)
      
      res.json({
        ok: true,
        users: result.users,
        total: result.total,
        hasMore: result.hasMore
      })
    } catch (error) {
      next(error)
    }
  }

  // In your UsersController class:

  updateProfile = async (req, res, next) => {
    try {
      // const userId = req.user.id;
      const { id } = req.validParams || { id: Number(req.params.id) };
      const userId = id;
      const user = await this.service.updateProfile(userId, {...req.validBody, ...req.body});
      res.json({ ok: true, user });
    } catch (error) {
      next(error);
    }
  };

  updateUserProfile = async (req, res, next) => {
    try {
      const userId = req.user.id; // self

      const user = await this.service.updateUserProfile(userId, {...req.validBody, ...req.body})

      res.json({ ok: true, user});

    } catch (error) {
      console.error('Error: updating user profile', error)
      next(error);
    }
  }

  uploadAvatar = async (req, res, next) => {
    try {
      // Get user ID from route params (allows admin to update any user's avatar)
      const { id } = req.validParams || { id: Number(req.params.id) };
      const userId = id;
      const userInfo = await this.service.getById(id);

      const avatarKey = userInfo.avatar_key;

      this.deleteAvatarFile(avatarKey);

      // Create multer instance
      const upload = multer({
        storage: multer.diskStorage({
          destination: (req, file, cb) => {
            const uploadDir = 'uploads/avatars/';
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            const filename = `avatar-${userId}-${uniqueSuffix}${ext}`;
            cb(null, filename);
          }
        }),
        fileFilter: (req, file, cb) => {
          if (file.mimetype.startsWith('image/')) {
            
            cb(null, true);
          } else {
            cb(new Error('Only image files are allowed'), false);
          }
        },
        limits: {
          fileSize: 5 * 1024 * 1024 // 5MB limit
        }
      });

      // Wrap the multer middleware in a Promise to handle it properly
      const uploadPromise = new Promise((resolve, reject) => {
        upload.single('avatar')(req, res, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      await uploadPromise;

      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No avatar file uploaded' });
      }

      

      // Process image to get metadata
      const imageBuffer = await sharp(req.file.path)
        .metadata()
        .then(metadata => ({
          width: metadata.width,
          height: metadata.height,
          mime: metadata.format,
          bytes: req.file.size
        }));

      const avatarData = {
        avatar_key: req.file.filename,
        avatar_url: `/uploads/avatars/${req.file.filename}`,
        avatar_mime: `image/${imageBuffer.mime}`,
        avatar_bytes: imageBuffer.bytes,
        avatar_width: imageBuffer.width,
        avatar_height: imageBuffer.height
      };

      const user = await this.service.updateAvatar(userId, avatarData);

      res.json({ ok: true, user });
    } catch (error) {
      console.error('Upload error:', error); // Debug log
      next(error);
    }
  };

  changePassword = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const result = await this.service.changePassword(userId, req.validBody);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/users/avatar
   * Remove user's avatar (delete file and clear database fields)
   */
  removeAvatar = async (req, res, next) => {
    try {
      // Get user ID from route params (allows admin to remove any user's avatar)
      const { id } = req.validParams || { id: Number(req.params.id) };
      const userId = id;

      // Get avatar key and remove from database
      const result = await this.service.removeAvatar(userId);

      // // Delete the file from filesystem if it exists
      // if (result.avatarKey) {
      //   const filePath = path.join('uploads', 'avatars', result.avatarKey);
      //   try {
      //     if (fs.existsSync(filePath)) {
      //       fs.unlinkSync(filePath);
      //       // eslint-disable-next-line no-console
      //     }
      //   } catch (fileError) {
      //     // Log error but don't fail the request if file deletion fails
      //     // (file might have been manually deleted or doesn't exist)
      //     // eslint-disable-next-line no-console
      //     console.warn(`Warning: Could not delete avatar file ${filePath}:`, fileError.message);
      //   }
      // }

      this.deleteAvatarFile(result.avatarKey)

      res.json({ ok: true, user: result.user });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Remove avatar error:', error);
      next(error);
    }
  };

  deleteAvatarFile(avatarKey) {
    // Delete the file from filesystem if it exists
    if (avatarKey) {
      const filePath = path.join('uploads', 'avatars', avatarKey);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          // eslint-disable-next-line no-console
        }
      } catch (fileError) {
        // Log error but don't fail the request if file deletion fails
        // (file might have been manually deleted or doesn't exist)
        // eslint-disable-next-line no-console
        console.warn(`Warning: Could not delete avatar file ${filePath}:`, fileError.message);
      }
    }
  }

  /**
   * GET /api/users/:id/permissions
   * Get user's roles and directly assigned rules
   */
  getPermissions = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const permissions = await this.service.getUserRolesAndRules(id)
      res.json({ ok: true, ...permissions })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PATCH /api/users/:id/toggle-status
   * Toggle user active status (admin only)
   */
  toggleUserStatus = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const user = await this.service.toggleUserStatus(id)
      res.json({ ok: true, user })
    } catch (error) {
      next(error)
    }
  }
}

