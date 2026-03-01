Rails.application.routes.draw do
  # =============================================================================
  # OAuth 2.1 Authorization Server
  # =============================================================================

  # Well-known discovery endpoints (RFC 9728, RFC 8414)
  get ".well-known/oauth-protected-resource" => "well_known#oauth_protected_resource"
  get ".well-known/oauth-authorization-server" => "well_known#oauth_authorization_server"
  get ".well-known/openid-configuration" => "well_known#openid_configuration"

  # OAuth authorization and token endpoints
  scope :oauth do
    get "authorize", to: "oauth#authorize"
    post "authorize", to: "oauth#authorize_decision"
    post "token", to: "oauth#token"
    post "register", to: "oauth#register"
    post "revoke", to: "oauth#revoke"
  end

  # =============================================================================
  # MCP (Model Context Protocol) Remote Server
  # =============================================================================

  # Streamable HTTP transport (primary)
  post "mcp", to: "mcp#handle"

  # SSE transport (legacy/fallback)
  get "mcp", to: "mcp#sse_connect"
  post "mcp/messages", to: "mcp#sse_message"

  # =============================================================================
  # API Keys (for MCP server and other integrations)
  # =============================================================================
  resources :api_keys, only: %i[index create destroy]

  # Workspaces
  resources :workspaces do
    resources :memberships, controller: "workspace_memberships", only: %i[index update destroy]
    resources :invites, controller: "workspace_invites", only: %i[index create destroy] do
      collection do
        post :regenerate
      end
    end
    resource :company_profile, only: %i[show update]
    resources :addresses, only: %i[index show create update destroy] do
      member do
        post :set_default
      end
    end
  end

  # Workspace invite acceptance (token-based, public for show)
  get "workspace_invite/:token" => "workspace_invites#show"
  post "workspace_invite/:token/accept" => "workspace_invites#accept"

  resources :gifts do
    member do
      patch :reorder
    end
    resources :gift_recipients, only: [ :update ]
  end
  resources :gift_statuses

  # Gift Exchanges
  resources :gift_exchanges do
    member do
      post :start
    end
    resources :exchange_participants, only: %i[index show create update destroy] do
      member do
        post :resend_invite
      end
      resources :exchange_wishlist_items, only: %i[index show create update destroy]
    end
    resources :exchange_exclusions, only: %i[index create destroy]
  end

  # Exchange invite endpoints (token-based)
  get "exchange_invite/:token" => "exchange_invites#show"
  post "exchange_invite/:token/accept" => "exchange_invites#accept"
  post "exchange_invite/:token/decline" => "exchange_invites#decline"

  # Wishlists (authenticated)
  resources :wishlists do
    member do
      post :share
      delete :revoke_share
      post :reveal_claims
    end
    resources :wishlist_items, only: %i[index show create update destroy] do
      collection do
        patch :reorder
      end
      member do
        post :claim
        delete :unclaim
        patch :mark_purchased
      end
    end
  end

  # Public wishlist access (token-based, no auth required)
  get "w/:token" => "public_wishlists#show"
  post "w/:token/items/:item_id/claim" => "public_wishlists#claim"

  # Guest claim management (token-based, no auth required)
  get "claim/:token" => "guest_claims#show"
  patch "claim/:token" => "guest_claims#update"
  delete "claim/:token" => "guest_claims#destroy"

  resources :holidays do
    collection do
      get :templates
      post :join
    end
    member do
      get :share
      post :share
      delete :leave
      get :collaborators
      delete "collaborators/:user_id", action: :remove_collaborator, as: :remove_collaborator
    end
    resources :match_arrangements, only: [ :index ], controller: "match_arrangements", action: :by_holiday
  end

  resources :match_arrangements, only: %i[index show create update destroy]
  resources :people do
    resources :gift_suggestions, only: %i[index create] do
      collection do
        post :refine
      end
    end
  end

  # Imports
  post "imports/people" => "imports#people"

  # Exports
  get "exports/gifts" => "exports#gifts"
  get "exports/people" => "exports#people"

  resources :gift_suggestions, only: %i[destroy] do
    member do
      post :accept
    end
  end

  # Billing
  get "billing/status" => "billing#status"
  get "billing/charity_stats" => "billing#charity_stats"
  post "billing/create_checkout_session" => "billing#create_checkout_session"
  post "billing/redeem_coupon" => "billing#redeem_coupon"
  post "billing/webhook" => "billing#webhook"

  # Profile
  post "profile/sync" => "profile#sync"

  # Notification preferences (authenticated)
  resource :notification_preferences, only: %i[show update] do
    get :email_history, on: :collection
  end

  # Email preferences (token-based, no auth)
  get "email_preferences/:token" => "email_preferences#show"
  patch "email_preferences/:token" => "email_preferences#update"

  # Health check endpoints
  get "up" => "rails/health#show", as: :rails_health_check
  get "/" => "health#show", as: :api_health

  root "health#show"
end
