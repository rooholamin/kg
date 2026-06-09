const roles = [
  {
    slug: 'admin',
    name: 'Admin',
    isProtected: true,
    description: 'Can manage settings, sections, categories, topics, pipeline engines, and schedule articles.',
  },
  {
    slug: 'editor',
    name: 'Editor',
    isDefault: true,
    description: 'Can view, edit, and approve or reject articles.',
  },
];

module.exports = roles;
