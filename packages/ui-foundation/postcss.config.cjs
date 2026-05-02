// PostCSS config for `@sc-app/ui-foundation` build.
//
// Two transforms only:
//   - postcss-import: inline the @import chain so the consumer (or
//     a future plugin runtime) loads a single CSS file from dist/.
//   - autoprefixer: add vendor prefixes where the spec is unstable
//     (notably ::-webkit-slider-thumb, mask, etc.).
//
// No tailwind, no nesting, no preset-env — the plan's "plain CSS
// only" constraint. If we ever need CSS nesting in source, switch
// to native (Chrome 112+ / Safari 16.5+) or revisit; do NOT pull in
// postcss-nested or sass.

module.exports = {
  plugins: [
    require('postcss-import')(),
    require('autoprefixer')(),
  ],
};
