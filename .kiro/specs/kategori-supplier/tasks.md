# Implementation Plan

- [x] 1. Setup database schema for categories and suppliers

  - [x] 1.1 Create SQL migration file


    - Add categories and suppliers tables
    - Add RLS policies
    - _Requirements: 1.1, 2.1_

- [x] 2. Implement Category API

  - [x] 2.1 Create category CRUD functions


    - Implement listCategories, createCategory, updateCategory, deleteCategory
    - Implement getCategoryProductCount for deletion check
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_


- [x] 3. Implement Supplier API





  - [x] 3.1 Create supplier CRUD functions

    - Implement listSuppliers, createSupplier, updateSupplier, deleteSupplier

    - Implement getSupplierProductCount for deletion check


    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Build Category Management Page









  - [x] 4.1 Create Kategori page with CRUD UI




    - Display categories table

    - Add create/edit modal

    - Add delete confirmation with product check
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_



- [x] 5. Build Supplier Management Page






  - [x] 5.1 Create Supplier page with CRUD UI

    - Display suppliers table
    - Add create/edit modal
    - Add delete confirmation with product check
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Update Product Form




  - [x] 6.1 Add category and supplier dropdowns to product form

    - Fetch categories and suppliers for dropdowns

    - Save associations when product is saved
    - _Requirements: 3.1, 3.2_

- [x] 7. Update Navigation






  - [x] 7.1 Add menu items for Kategori and Supplier pages

    - Update Sidebar component
    - Update App.tsx routing
    - _Requirements: 1.1, 2.1_
