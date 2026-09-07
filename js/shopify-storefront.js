/**
 * Headless Shopify Integration Module via Storefront API
 * Store: ss-designs-jpgl8vz6.myshopify.com
 */

const SHOPIFY_CONFIG = {
  storeDomain: 'ss-designs-jpgl8vz6.myshopify.com',
  publicAccessToken: '02c740462a756f5ad54157f8d00a6a05',
  apiVersion: '2024-07'
};

class ShopifyHeadless {
  constructor(config = SHOPIFY_CONFIG) {
    this.config = config;
    this.graphqlUrl = `https://${this.config.storeDomain}/api/${this.config.apiVersion}/graphql.json`;
    this.cartIdKey = 'shopify_headless_cart_id';
  }

  /**
   * Send a GraphQL request to Shopify Storefront API
   */
  async fetchGraphQL(query, variables = {}) {
    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.config.publicAccessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();
      if (result.errors) {
        console.error('Shopify GraphQL Errors:', result.errors);
      }
      return result.data;
    } catch (err) {
      console.error('Shopify API Connection Error:', err);
      return null;
    }
  }

  /**
   * Fetch all active products from Shopify store
   */
  async getProducts(limit = 20) {
    const query = `
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              description
              featuredImage {
                url
                altText
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await this.fetchGraphQL(query, { first: limit });
    return data?.products?.edges.map(e => e.node) || [];
  }

  /**
   * Create or fetch existing Shopify Cart
   */
  async getOrCreateCart() {
    let cartId = localStorage.getItem(this.cartIdKey);

    if (cartId) {
      const cartData = await this.getCart(cartId);
      if (cartData && cartData.cart) {
        return cartData.cart;
      }
    }

    // Create a new cart if missing or expired
    const query = `
      mutation cartCreate {
        cartCreate {
          cart {
            id
            checkoutUrl
            totalQuantity
            lines(first: 50) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      product {
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await this.fetchGraphQL(query);
    const newCart = data?.cartCreate?.cart;
    if (newCart?.id) {
      localStorage.setItem(this.cartIdKey, newCart.id);
    }
    return newCart;
  }

  /**
   * Get Cart Details by ID
   */
  async getCart(cartId) {
    const query = `
      query getCart($cartId: ID!) {
        cart(id: $cartId) {
          id
          checkoutUrl
          totalQuantity
          cost {
            totalAmount {
              amount
              currencyCode
            }
          }
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    product {
                      title
                      featuredImage {
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    return await this.fetchGraphQL(query, { cartId });
  }

  /**
   * Add Item to Shopify Cart
   * @param {string} variantId - Shopify Product Variant GID (e.g. "gid://shopify/ProductVariant/123456")
   * @param {number} quantity - Number of items to add
   */
  async addToCart(variantId, quantity = 1) {
    const cart = await this.getOrCreateCart();
    if (!cart?.id) return null;

    const query = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            totalQuantity
          }
        }
      }
    `;

    const variables = {
      cartId: cart.id,
      lines: [{ merchandiseId: variantId, quantity }],
    };

    const data = await this.fetchGraphQL(query, variables);
    return data?.cartLinesAdd?.cart;
  }

  /**
   * Redirect User directly to Shopify Checkout
   */
  async redirectToCheckout() {
    const cart = await this.getOrCreateCart();
    if (cart?.checkoutUrl) {
      window.location.href = cart.checkoutUrl;
    } else {
      alert('Cart is empty or unavailable.');
    }
  }
}

// Attach to window object for global access across static pages
window.ShopifyHeadless = ShopifyHeadless;
window.shopify = new ShopifyHeadless();
