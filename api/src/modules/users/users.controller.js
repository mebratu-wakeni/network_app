/**
 * Controller: HTTP layer for users
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { getAvatarsDir } from '../../config/storagePaths.js';
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

      res.json({
        ok: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          display_name: req.user.display_name,
          is_active: req.user.is_active,
          avatar_url: req.user.avatar_url || null,
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
      const user = await this.service.getById(req.tenantId, id)
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
      const result = await this.service.assignRoleToUser(req.tenantId, id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  deleteUser = async (req, res, next) => {
    try {
      const { id } = req.validParams;
      const loggedInUserId = Number(req.user.id);

      if (id === loggedInUserId) {
        const error = new Error('You cannot delete your own account');
        error.status = 403;
        return next(error);
      }

      const deletedUser = await this.service.deleteUser(req.tenantId, id);

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
      const result = await this.service.removeRoleFromUser(req.tenantId, id, req.validBody)
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
      const result = await this.service.assignRuleToUser(req.tenantId, id, req.validBody)
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
      const result = await this.service.removeRuleFromUser(req.tenantId, id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  getUsersList = async (req, res, next) => {
    try {
      const { searchQuery = '', tableConfig = {} } = req.validBody || {}
      const result = await this.service.getUsersList(req.tenantId, searchQuery, tableConfig)
      
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

  updateProfile = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) };
      const userId = id;
      const user = await this.service.updateProfile(req.tenantId, userId, {...req.validBody, ...req.body});
      res.json({ ok: true, user });
    } catch (error) {
      next(error);
    }
  };

  updateUserProfile = async (req, res, next) => {
    try {
      const userId = req.user.id;

      const user = await this.service.updateUserProfile(req.tenantId, userId, {...req.validBody, ...req.body})

      res.json({ ok: true, user});

    } catch (error) {
      console.error('Error: updating user profile', error)
      next(error);
    }
  }

  uploadAvatar = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) };
      const userId = id;
      const userInfo = await this.service.getById(req.tenantId, id);

      const avatarKey = userInfo.avatar_key;

      this.deleteAvatarFile(avatarKey);

      const upload = multer({
        storage: multer.diskStorage({
          destination: (req, file, cb) => {
            const uploadDir = getAvatarsDir()
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

      const user = await this.service.updateAvatar(req.tenantId, userId, avatarData);

      res.json({ ok: true, user });
    } catch (error) {
      console.error('Upload error:', error);
      next(error);
    }
  };

  changePassword = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const result = await this.service.changePassword(req.tenantId, userId, req.validBody);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  removeAvatar = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) };
      const userId = id;

      const result = await this.service.removeAvatar(req.tenantId, userId);

      this.deleteAvatarFile(result.avatarKey)

      res.json({ ok: true, user: result.user });
    } catch (error) {
      console.error('Remove avatar error:', error);
      next(error);
    }
  };

  deleteAvatarFile(avatarKey) {
    if (avatarKey) {
      const filePath = path.join(getAvatarsDir(), avatarKey);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.warn(`Warning: Could not delete avatar file ${filePath}:`, fileError.message);
      }
    }
  }

  getPermissions = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const permissions = await this.service.getUserRolesAndRules(req.tenantId, id)
      res.json({ ok: true, ...permissions })
    } catch (error) {
      next(error)
    }
  }

  toggleUserStatus = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const user = await this.service.toggleUserStatus(req.tenantId, id)
      res.json({ ok: true, user })
    } catch (error) {
      next(error)
    }
  }
}
