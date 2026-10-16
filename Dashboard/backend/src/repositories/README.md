# Repositories

This layer is the data-source boundary for application services. Repositories perform data access and filtering only; summary and chart aggregation belong to services, while HTTP translation belongs to controllers. The health check does not use a repository because it does not access data.

`DashboardRepository` lets future dashboard services consume prediction records without depending on a particular source. `MockDashboardRepository` provides explicitly fictitious data for frontend and backend development before model integration. A future Supabase-backed repository must satisfy the same interface.

The mock values represent estimated billed-item utilization volume, not patient counts. Opportunity tiers are assigned directly in the fixture and are not calculated by the repository. Activity status is not verticalization, and neither concept is inferred here.

Mock results use OR semantics within one filter category and AND semantics across categories. Their default order is forecast month ascending, predicted demand volume descending, operator ID ascending, and prediction ID ascending as a final tie-breaker.
