class WishlistBlueprint < ApplicationBlueprint
  fields :name, :description, :visibility, :anti_spoiler_enabled, :target_date, :created_at, :updated_at

  field :user_id do |wishlist|
    wishlist.user_id
  end

  field :workspace_id do |wishlist|
    wishlist.workspace_id
  end

  field :is_owner do |wishlist, options|
    options[:current_user] && wishlist.owner?(options[:current_user])
  end

  field :share_token do |wishlist, options|
    # Only show token to owner
    if options[:current_user] && wishlist.owner?(options[:current_user])
      wishlist.share_token
    end
  end

  field :share_url do |wishlist, options|
    if options[:current_user] && wishlist.owner?(options[:current_user]) && wishlist.share_token
      "#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000')}/w/#{wishlist.share_token}"
    end
  end

  field :item_count do |wishlist|
    wishlist.item_count
  end

  field :claimed_count do |wishlist, options|
    wishlist.claimed_count(viewer: options[:current_user])
  end

  field :owner do |wishlist|
    {
      id: wishlist.user.id,
      name: wishlist.user.safe_name,
      image_url: wishlist.user.image_url
    }
  end

  view :with_items do
    association :wishlist_items, blueprint: WishlistItemBlueprint do |wishlist, _options|
      wishlist.wishlist_items.active.by_priority
    end
  end

  view :public do
    excludes :share_token, :share_url

    field :viewer_is_owner do |wishlist, options|
      wishlist.owner?(options[:current_user])
    end

    # Blueprinter only merges a Hash here. A lambda is silently ignored.
    association :wishlist_items, blueprint: WishlistItemBlueprint, options: { public_view: true } do |wishlist, _options|
      wishlist.wishlist_items.active.by_priority
    end
  end

  view :minimal do
    fields :name, :target_date
    field :owner do |wishlist|
      { name: wishlist.user.safe_name }
    end
  end
end
