/**
 * The stylesheet is pulled in for its side effect — NativeWind's Metro
 * transformer turns it into the style registry — so there is nothing to import
 * and TypeScript needs telling the module exists.
 */
declare module "*.css";
