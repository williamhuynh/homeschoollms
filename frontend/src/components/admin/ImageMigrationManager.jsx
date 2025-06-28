import React, { useState, useEffect } from 'react';
import { 
  getMigrationStatus, 
  listMigrationImages, 
  migrateSingleImage, 
  bulkMigrateImages, 
  setMigrationMode 
} from '../../services/api';

const ImageMigrationManager = () => {
  const [status, setStatus] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentView, setCurrentView] = useState('status'); // status, public, private
  const [migrationResults, setMigrationResults] = useState(null);

  useEffect(() => {
    fetchMigrationStatus();
  }, []);

  const fetchMigrationStatus = async () => {
    try {
      setLoading(true);
      const data = await getMigrationStatus();
      setStatus(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async (type = 'public') => {
    try {
      setLoading(true);
      const data = await listMigrationImages(type, 100);
      setImages(data.images);
      setSelectedImages([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateSelected = async () => {
    if (selectedImages.length === 0) {
      setError('Please select images to migrate');
      return;
    }

    try {
      setMigrating(true);
      setError(null);
      
      const publicIds = selectedImages.map(img => img.public_id);
      const results = await bulkMigrateImages(publicIds);
      
      setMigrationResults(results);
      setSuccess(`Successfully migrated ${results.successful} images`);
      
      // Refresh the images list
      fetchImages('public');
      fetchMigrationStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setMigrating(false);
    }
  };

  const handleMigrateSingle = async (publicId) => {
    try {
      setMigrating(true);
      await migrateSingleImage(publicId);
      setSuccess(`Successfully migrated image: ${publicId}`);
      
      // Refresh the images list
      fetchImages('public');
      fetchMigrationStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setMigrating(false);
    }
  };

  const handleModeChange = async (newMode) => {
    try {
      setLoading(true);
      const result = await setMigrationMode(newMode);
      setSuccess(result.message);
      fetchMigrationStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = (image) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.public_id === image.public_id);
      if (isSelected) {
        return prev.filter(img => img.public_id !== image.public_id);
      } else {
        return [...prev, image];
      }
    });
  };

  const selectAllImages = () => {
    setSelectedImages(images);
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const getModeDisplayName = (mode) => {
    switch (mode) {
      case 'public': return 'Public (Legacy)';
      case 'hybrid': return 'Hybrid (Recommended)';
      case 'private': return 'Private (Secure)';
      default: return mode;
    }
  };

  const getModeDescription = (mode) => {
    switch (mode) {
      case 'public': return 'All images served publicly via Cloudinary';
      case 'hybrid': return 'New images private, legacy images public (recommended for migration)';
      case 'private': return 'All images require authentication';
      default: return '';
    }
  };

  if (loading && !status) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Image Migration Manager</h2>
        
        {/* Navigation */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setCurrentView('status')}
            className={`px-4 py-2 rounded ${currentView === 'status' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Status
          </button>
          <button
            onClick={() => { setCurrentView('public'); fetchImages('public'); }}
            className={`px-4 py-2 rounded ${currentView === 'public' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Public Images ({status?.public_images || 0})
          </button>
          <button
            onClick={() => { setCurrentView('private'); fetchImages('authenticated'); }}
            className={`px-4 py-2 rounded ${currentView === 'private' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Private Images ({status?.private_images || 0})
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button 
              onClick={() => setError(null)} 
              className="float-right text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
            <button 
              onClick={() => setSuccess(null)} 
              className="float-right text-green-500 hover:text-green-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Status View */}
        {currentView === 'status' && status && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <h3 className="font-semibold text-blue-800">Current Mode</h3>
                <p className="text-2xl font-bold text-blue-600">{getModeDisplayName(status.migration_mode)}</p>
                <p className="text-sm text-blue-600">{getModeDescription(status.migration_mode)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded">
                <h3 className="font-semibold text-orange-800">Public Images</h3>
                <p className="text-2xl font-bold text-orange-600">{status.public_images}</p>
                <p className="text-sm text-orange-600">Legacy images</p>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <h3 className="font-semibold text-green-800">Private Images</h3>
                <p className="text-2xl font-bold text-green-600">{status.private_images}</p>
                <p className="text-sm text-green-600">Secure images</p>
              </div>
            </div>

            {/* Mode Switch */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Change Migration Mode</h3>
              <div className="space-y-2">
                {['public', 'hybrid', 'private'].map(mode => (
                  <label key={mode} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="migrationMode"
                      value={mode}
                      checked={status.migration_mode === mode}
                      onChange={() => handleModeChange(mode)}
                      className="form-radio"
                    />
                    <span className="font-medium">{getModeDisplayName(mode)}</span>
                    <span className="text-gray-600">- {getModeDescription(mode)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Images View */}
        {(currentView === 'public' || currentView === 'private') && (
          <div className="space-y-4">
            {/* Controls */}
            {currentView === 'public' && images.length > 0 && (
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {selectedImages.length} of {images.length} selected
                  </span>
                  <button
                    onClick={selectAllImages}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-gray-600 hover:text-gray-800 text-sm"
                  >
                    Clear
                  </button>
                </div>
                <button
                  onClick={handleMigrateSelected}
                  disabled={selectedImages.length === 0 || migrating}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {migrating ? 'Migrating...' : `Migrate Selected (${selectedImages.length})`}
                </button>
              </div>
            )}

            {/* Images Grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-gray-200 animate-pulse h-32 rounded"></div>
                ))}
              </div>
            ) : images.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((image) => (
                  <div key={image.public_id} className="border rounded p-2">
                    <img
                      src={image.url}
                      alt={image.public_id}
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                    <p className="text-xs text-gray-600 truncate">{image.public_id}</p>
                    <p className="text-xs text-gray-500">{Math.round(image.bytes / 1024)}KB</p>
                    
                    {currentView === 'public' && (
                      <div className="flex items-center justify-between mt-2">
                        <input
                          type="checkbox"
                          checked={selectedImages.some(img => img.public_id === image.public_id)}
                          onChange={() => toggleImageSelection(image)}
                          className="form-checkbox"
                        />
                        <button
                          onClick={() => handleMigrateSingle(image.public_id)}
                          disabled={migrating}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:bg-gray-400"
                        >
                          Migrate
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No {currentView} images found
              </div>
            )}
          </div>
        )}

        {/* Migration Results */}
        {migrationResults && (
          <div className="mt-6 bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Migration Results</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{migrationResults.total_processed}</div>
                <div className="text-sm text-gray-600">Total Processed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{migrationResults.successful}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{migrationResults.failed}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageMigrationManager; 